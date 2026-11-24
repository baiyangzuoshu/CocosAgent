import Cache from './cache';
/**
 * @module cc.AssetManager
 */

/**
 * !#en
 * Cache manager is a module which controls all caches downloaded from server in non-web platform, it is a singleton
 * All member can be accessed with `cc.assetManager.cacheManager`.
 * 
 * !#zh
 * 缓存管理器是一个模块，在非 WEB 平台上，用于管理所有从服务器上下载下来的缓存，这是一个单例，所有成员能通过 `cc.assetManager.cacheManager` 访问。
 * 
 * @class CacheManager
 */
export abstract class CacheManager {
   
    public abstract cacheDir: String;

    
    public abstract cacheEnabled: Boolean;

  
    public abstract autoClear: Boolean;

    public abstract cacheInterval: Number;

   
    public abstract deleteInterval: Number;

    
    public abstract cachedFiles: Cache;

   
    public abstract getCache (originUrl: string): string;

   
    public abstract getTemp (originUrl: string): string;

 
    public abstract clearCache (): void;

    public abstract clearLRU (): void;

   
    public abstract removeCache (originUrl: string): void;
}
