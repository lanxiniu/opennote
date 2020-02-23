export namespace _ {
    /**
     * Programatically saves a file to the browser
     * @param data the data to save
     * @param name name of file
     * @param type MIME type
     */
    export function saveFile(data: any, name: string, type: string = 'text/plain') {
        const blob = new Blob([data], {type});
        const e = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 0,
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            button: 0,
            relatedTarget: null
        });
        const a = document.createElement('a');
        a.download = name;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
        a.dispatchEvent(e);
    }

    /**
     * Prompts a user for a file and returns the raw data
     */
    export function getFiles(): Promise<ArrayBuffer[]> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.onote';
            input.multiple = true;
            input.addEventListener('change', function(ev) {
                if (!this.files) return reject(new Error('missing files property'));
                resolve(Promise.all(Array.from(this.files).filter(file => file.name.endsWith('.onote')).map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsArrayBuffer(file);
                        reader.addEventListener('load', function() {
                            resolve(this.result as ArrayBuffer);
                        });
                    }) as Promise<ArrayBuffer>;
                })));
            });
            input.click();
        });
    }

    /**
     * Prompts a user for a file and decodes it to a string
     */
    export function getFilesAsString(): Promise<string[]> {
        return getFiles().then(files => {
            const decoder = new TextDecoder('utf-8');
            return files.map(file => decoder.decode(file));
        });
    }

    export function registerDevModule(data: any) {
        Object.assign(window, data);
    }
}

export default _;