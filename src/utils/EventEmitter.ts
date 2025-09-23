// src/utils/EventEmitter.ts

type Listener<T> = (payload: T) => void;

export class EventEmitter<Events extends object> {
    private listeners: {
        [K in keyof Events]?: Array<Listener<Events[K]>>;
    } = {};

    on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]?.push(listener);
    }

    off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
        this.listeners[event] = this.listeners[event]?.filter(
            (l) => l !== listener
        );
    }

    emit<K extends keyof Events>(event: K, payload: Events[K]): void {
        this.listeners[event]?.forEach((l) => l(payload));
    }
}
