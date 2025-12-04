import threading
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


def debounce(wait_time):
    def decorator(func):
        timer = None
        last_call_args = None
        last_call_kwargs = None

        def debounced_func(*args, **kwargs):
            nonlocal timer, last_call_args, last_call_kwargs
            last_call_args = args
            last_call_kwargs = kwargs

            if timer is not None:
                timer.cancel()

            timer = threading.Timer(wait_time, lambda: func(*last_call_args, **last_call_kwargs))
            timer.start()

        return debounced_func
    return decorator


@debounce(5)
def run_build_command():
    pass


class MyHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            print("New file:", event.src_path)
            run_build_command()

    def on_deleted(self, event):
        print("Deleted:", event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            print("File modified:", event.src_path)
            run_build_command()

    def on_moved(self, event):
        print(f"Filed moved from {event.src_path} to {event.dest_path}")
        run_build_command()


def main():
    path = "source"
    event_handler = MyHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()

    observer.join()


if __name__ == "__main__":
    main()
