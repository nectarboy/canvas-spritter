// A circular pool factory that doesn't care to check if an object is in use or not.
function MakeCircularPoolConstructor(classCtor, size) {
    let circularPoolConstructor = class {
        constructor() {
            this.index = 0;
            this.size = size;
            this.buffer = new Array(size);
            for (let i = 0; i < size; i++)
                this.buffer[i] = new classCtor();
        }

        Get() {
            this.index = (this.index === this.size) ? 0 : this.index;
            return this.buffer[this.index++];
        }

        Release(obj) {
            obj.Reset();
        }
    }

    return circularPoolConstructor;
}

export default MakeCircularPoolConstructor;