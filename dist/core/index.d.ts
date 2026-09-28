import { R as RouteSource, G as GenerateParams, A as AppTypeSnapshotPath, a as ApiGroup, O as OpenApiPath, b as RunGenerateOptions } from '../runGenerate-BnyECYbm.js';
export { r as runGenerate } from '../runGenerate-BnyECYbm.js';
import { OpenAPIV3 } from 'openapi-types';
import 'ts-morph';

interface GroupCacheEntry {
    /** Combined SHA-256 of all source files in this group's dependency graph */
    inputHash: string;
    /** Absolute path to the cached openapi/<name>.json output file */
    outputPath: string;
    /** List of dependency files discovered in the AST graph */
    dependencyFiles?: string[];
}
interface RouteCacheEntry {
    dependencyHash: string;
    operation: OpenAPIV3.OperationObject;
    sources?: RouteSource[];
    dependencyFiles?: string[];
}
declare class CacheManager {
    private manifest;
    private readonly manifestPath;
    private readonly pkgVersion;
    private dirty;
    constructor(rootPath: string, pkgVersion: string);
    /**
     * Compute a SHA-256 hex digest of a single file's content.
     * Returns an empty string if the file cannot be read (treated as "changed").
     */
    hashFile(filePath: string): string;
    /**
     * Compute a combined SHA-256 over an ordered list of file paths.
     * Hashes both the paths and their contents so renames are detected.
     */
    hashGroup(filePaths: string[]): string;
    /**
     * Compute a hash of a short string value (e.g. config contents).
     */
    hashString(value: string): string;
    /**
     * Check whether the global hash (version + config + tsconfig) has changed.
     * If it has, wipe the entire cache before proceeding.
     * Returns true if cache is still valid, false if it was wiped.
     */
    checkGlobal(globalHash: string): boolean;
    /**
     * Wipe all cached state. Called on global invalidation or --no-cache flag.
     */
    invalidate(): void;
    /**
     * Returns the cached output path if the group's input hash matches
     * and the cached file still exists on disk. Returns null on cache miss.
     */
    getGroupCache(groupName: string, groupHash: string): string | null;
    /**
     * Returns the full group cache entry if available.
     */
    getGroupEntry(groupName: string): GroupCacheEntry | null;
    /**
     * Record a successful group generation in the cache.
     */
    setGroupCache(groupName: string, groupHash: string, outputPath: string, dependencyFiles?: string[]): void;
    /**
     * Returns a cached OpenAPI schema object if available, or null on cache miss.
     * Key is: sha256(filePath) + exportName + sha256(fileContent)
     */
    getSchemaCache(schemaKey: string): OpenAPIV3.SchemaObject | null;
    /**
     * Store a resolved schema in the schema cache.
     */
    setSchemaCache(schemaKey: string, schema: OpenAPIV3.SchemaObject): void;
    /**
     * Returns a cached OpenAPI Operation object for an endpoint if its source file hash matches.
     */
    getRouteCache(routeKey: string, dependencyHash: string): RouteCacheEntry | null;
    /**
     * Record a generated OpenAPI Operation object in the fine-grained per-route cache.
     */
    setRouteCache(routeKey: string, dependencyHash: string, operation: OpenAPIV3.OperationObject, sources?: RouteSource[], dependencyFiles?: string[]): void;
    /**
     * Persist the in-memory manifest to disk.
     * Only writes if something actually changed (dirty flag).
     * Non-fatal: a failed flush just means the next run starts cold.
     */
    flush(): void;
    private _load;
}

declare function generateOpenApi({ config, snapshotPath, fileName, project, rootPath, outputRoot, cacheManager, }: // {
GenerateParams & {
    snapshotPath: AppTypeSnapshotPath;
    apiGroup: ApiGroup;
    cacheManager?: CacheManager;
}): Promise<OpenApiPath>;

declare function generateTypes({ config, rootPath, apiGroup, fileName, }: GenerateParams & {
    apiGroup: ApiGroup;
}): Promise<{
    appTypePath: string;
    name: string;
}>;

declare function runWatch(configPath: string, options?: RunGenerateOptions): Promise<void>;

export { RunGenerateOptions, generateOpenApi, generateTypes, runWatch };
