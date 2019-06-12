import { Subject, Observer, Observable, interval } from 'rxjs';
import { WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import { share , takeWhile, distinctUntilChanged } from 'rxjs/operators';

export class RxWebSocket<T> extends Subject<T>{
    private reconnectionObservable : Observable<number>;
    private wsSubjectConfig : WebSocketSubjectConfig<any>; 
    private socket : WebSocketSubject<any>;
    private connectionObserver : Observer<boolean>;
    public connectionStatus : Observable<any>;

    defaultResultSelector = (e : MessageEvent )=>{
        return JSON.parse(e.data);
    }

    defaultSerializer = (data : any) : string =>{
        return JSON.stringify(data);
    }

    constructor(
        private url : string,
        private reconnectInterval : number = 5000,
        private reconnectAttempts : number = 10,
        private resultSelector ? : (e: MessageEvent ) => any,
        private serializer ? : (data : any) => string
    ){
        super();

        this.connectionStatus = new Observable((observer)=>{
            this.connectionObserver = observer;
        }).pipe(share(), distinctUntilChanged());

        if(!this.resultSelector){
            this.resultSelector = this.defaultResultSelector;
        }
        if(!this.serializer){
            this.serializer = this.defaultSerializer;
        }

        this.wsSubjectConfig = {
            url: this.url,
            closeObserver:{
                next: (e : CloseEvent)=>{
                    this.socket = null;
                    this.connectionObserver.next(false);
                }
            },
            openObserver: {
                next : (e : Event) =>{
                    this.connectionObserver.next(true);
                }
            }
        };
        this.connect();
        
    }

    connect(): void{
        this.socket = new WebSocketSubject(this.wsSubjectConfig);
        this.socket.subscribe(
            (m)=>{
                this.next(m);
            },
            (error: Event) =>{
                if(!this.socket){
                    this.reconnect();
                }
            }
        );
    }

    reconnect(){
        this.reconnectionObservable = interval(this.reconnectInterval)
        .pipe(takeWhile((v, index)=>{
            return index < this.reconnectAttempts && !this.socket
        }));

        this.reconnectionObservable.subscribe(
            ()=>{
                this.connect();
            },
            null,
            ()=>{
                this.reconnectionObservable = null;
                if(!this.socket){
                    this.complete();
                    this.connectionObserver.complete();
                }
            }
        );
    }

    send(data : any): void{
        this.socket.next(this.serializer(data));
    }


}