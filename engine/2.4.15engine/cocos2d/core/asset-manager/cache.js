/**
 * @module cc.AssetManager
 */

const js = require('../platform/js');
/**
 * !#en
 * use to cache something
 * 
 * !#zh
 * 用于缓存某些内容
 * 
 * @class Cache
 * @typescript Cache<T = any>
 */
function Cache (map) {
    if (map) {
        this._map = map;
        this._count = Object.keys(map).length;
    }
    else {
        this._map = js.createMap(true);
        this._count = 0;
    }
}

Cache.prototype = {
    
  
    constructor: Cache,

   
    add (key, val) {       
        if (!(key in this._map)) this._count++;
        return this._map[key] = val;
    },

   
    get (key) {
        return this._map[key];
    },

   
    has (key) {
        return key in this._map;
    },

    remove (key) {
        var out = this._map[key];
        if (key in this._map) {
            delete this._map[key];
            this._count--;
        }
        return out;
    },

   
    clear () {
        if (this._count !== 0) {
            this._map = js.createMap(true);
            this._count = 0;
        }
    },

    
    forEach (func) {
        for (var key in this._map) {
            func(this._map[key], key);
        }
    },

    /**
     * !#en
     * Enumerate all content to find one element which can fulfill condition
     * 
     * !#zh
     * 枚举所有内容，找到一个可以满足条件的元素
     * 
     * @method find
     * @param {Function} predicate - The condition
     * @returns {*} content
     * 
     * @example
     * var cache = new Cache();
     * var val = cache.find((val, key) => key === 'test');
     * 
     * @typescript
     * find(predicate: (val: T, key: string) => boolean): T
     */
    find (predicate) {
        for (var key in this._map) {
            if (predicate(this._map[key], key)) return this._map[key];
        }
        return null;
    },

    /**
     * !#en
     * The count of cached content
     * 
     * !#zh
     * 缓存数量
     * 
     * @property count
     * @type {Number}
     */
    get count () {
        return this._count;
    },

    /**
     * !#en
     * Destroy this cache
     * 
     * !#zh
     * 销毁这个 cache
     * 
     * @method destroy
     * 
     * @typescript
     * destroy(): void
     */
    destroy () {
        this._map = null;
    }
};

module.exports = Cache;