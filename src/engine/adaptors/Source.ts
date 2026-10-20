/**
 * One-hop invalidation channel. A source tells its subscribers "you are stale" and carries no data: each subscriber
 * schedules its own pre-frame task and pulls the current state top-down when that task runs.
 *
 * Subscribers are keyed (usually by the subscriber's uuid), so subscribing twice replaces instead of duplicating, and
 * every subscribe needs a matching unsubscribe when the link is replaced or removed, or the old target stays alive.
 */
export class Source<T = void> {
    private readonly subscribers = new Map<string, (value: T) => void>();

    subscribe(key: string, fn: (value: T) => void): void {
        this.subscribers.set(key, fn);
    }

    unsubscribe(key: string): void {
        this.subscribers.delete(key);
    }

    notify(value: T): void {
        // copy: a subscriber may unsubscribe while being notified
        for (const fn of Array.from(this.subscribers.values())) fn(value);
    }

    get size(): number {
        return this.subscribers.size;
    }
}
