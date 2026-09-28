import { Project } from 'ts-morph';
import { OpenAPIV3 } from 'openapi-types';

declare const HONO_METHOD_NAMES: readonly ["get", "post", "put", "patch", "delete", "options", "head", "all"];
declare const VALIDATOR_TARGETS: readonly ["json", "form", "query", "param", "header", "cookie"];
declare const VALIDATOR_LIBRARIES: readonly ["zod", "valibot", "typebox", "yup", "arktype", "unsupported"];

/** Supported lowercase Hono HTTP methods */
type HonoMethod = (typeof HONO_METHOD_NAMES)[number];
/**
 * The base OpenAPI configuration, excluding dynamically generated fields.
 *
 * This config maps directly to the OpenAPI 3.0 `Document` type,
 * excluding `paths`, `components`, and `tags` which are generated.
 */
type OpenAPIConfig = Omit<OpenAPIV3.Document, "paths" | "components" | "tags">;
/**
 * Describes a single HTTP API endpoint under a route.
 */
type Api = {
    /**
     * The path of the API (excluding any prefix), e.g., `/devices/d/{deviceId}`.
     */
    api: string;
    /**
     * Optional summary displayed in generated docs.
     */
    summary?: string;
    /**
     * Detailed description of the endpoint for OpenAPI docs.
     */
    description?: string;
    /**
     * OpenAPI tags used to group this endpoint in the docs.
     */
    tag?: string[];
    /**
     * HTTP method supported by this endpoint.
     */
    method: "get" | "post" | "put" | "patch" | "delete";
};
/**
 * Represents a group of related API routes, each with a shared prefix and appType.
 */
type ApiGroup = {
    /**
     * URL prefix applied to all `api` paths within this group (e.g., `/auth`).
     */
    apiPrefix: string;
    /**
     * File path to the module exporting `AppType = typeof routeInstance`.
     */
    appTypePath: string;
    /**
     * Human-readable name for the group, shown in logs and docs.
     */
    name: string;
    /**
     * Optional list of specific routes to include; if omitted, all from AppType are used.
     */
    api?: Api[];
};
/**
 * Top-level configuration object for hono-docs.
 */
type HonoDocsConfig = {
    /**
     * Path to your `tsconfig.json`.
     */
    tsConfigPath: string;
    /**
     * The OpenAPI specification version to emit.
     *
     * - `"3.0"` — OpenAPI 3.0.3 (default, no breaking change for existing configs)
     * - `"3.1"` — OpenAPI 3.1.0 (JSON Schema 2020-12 compliant; nullable types
     *    become `type: [T, "null"]` instead of `nullable: true`)
     *
     * @default "3.0"
     */
    openApiVersion?: "3.0" | "3.1";
    /**
     * Static parts of the OpenAPI document (title, version, servers, etc.).
     */
    openApi: OpenAPIConfig;
    /**
     * Output configuration for generated files.
     */
    outputs: {
        /**
         * File path where the generated `openapi.json` should be saved.
         */
        openApiJson: string;
        /**
         * File path where the generated `openapi.yaml` should be saved.
         */
        openApiYaml?: string;
    } | {
        openApiJson?: string;
        openApiYaml: string;
    };
    /**
     * List of API groups (routes) to generate docs for.
     */
    apis: ApiGroup[];
    /**
     * Derives a tag from an endpoint's final path (e.g. `/api/users/{id}`).
     * Returning a tag replaces the JSDoc `@tag` and group name tags;
     * returning `undefined` keeps them.
     */
    tagResolver?: (path: string) => string | undefined;
    /**
     * Metadata for tags, keyed by tag name, emitted in the document's top-level `tags`.
     *
     * @example { Users: { description: "User management" } }
     */
    tags?: Record<string, Omit<OpenAPIV3.TagObject, "name">>;
    /**
     * Transforms each operation after tags are applied. Return `null` to exclude it.
     * `path` is the endpoint's final path (e.g. `/api/users/{id}`).
     */
    transformOperation?: (operation: OpenAPIV3.OperationObject, context: {
        path: string;
        method: HonoMethod;
    }) => OpenAPIV3.OperationObject | null;
    /**
     * Transforms the final document before validation and writing,
     * e.g. to add `components.securitySchemes`.
     */
    transformDocument?: (spec: OpenAPIV3.Document) => OpenAPIV3.Document;
    /**
     * Whether to run the generated OpenAPI spec through a structural validator before output.
     * Prints warnings for any spec violations (e.g. invalid status codes, broken refs).
     * @default true
     */
    validateOutput?: boolean;
    /**
     * Optional raw string content to inject at the top of each generated `.d.ts` snapshot.
     */
    preDefineTypeContent?: string;
};
/**
 * Used to track a source route definition's `AppType` and friendly name.
 */
type AppTypeSnapshotPath = {
    /**
     * File path to the AppType export.
     */
    appTypePath: string;
    /**
     * Human-readable name for this route module.
     */
    name: string;
};
/**
 * Represents a single OpenAPI spec file output path.
 */
type OpenApiPath = {
    /**
     * Path to the generated `openapi.json` file.
     */
    openApiPath: string;
};
/**
 * Identifies which validation library a schema originated from.
 */
type ValidatorLibrary = (typeof VALIDATOR_LIBRARIES)[number];
/**
 * Valid slots that a Hono validator can target.
 */
type ValidatorTarget = (typeof VALIDATOR_TARGETS)[number];
/**
 * Enriched source tracking for logged and cached endpoints.
 */
type RouteSource = {
    src: ValidatorTarget;
    library: ValidatorLibrary | "ts type";
};
/**
 * Parameters required to generate the OpenAPI spec and TypeScript snapshots.
 */
type GenerateParams = {
    /**
     * Full hono-docs configuration object.
     */
    config: HonoDocsConfig;
    /**
     * Path to the output directory for emitted `.d.ts` files (typically inside `node_modules`).
     */
    libDir: string;
    /**
     * ts-morph project instance for analyzing TypeScript code.
     */
    project: Project;
    /**
     * Root path of the user’s project.
     */
    rootPath: string;
    /**
     * File name for the `.d.ts` output snapshot.
     */
    fileName: string;
    /**
     * Output directory for the OpenAPI and snapshot files.
     */
    outputRoot: string;
};

interface RunGenerateOptions {
    /** When true, bypass all cache reads and do not write a new cache. */
    noCache?: boolean;
    /** Persistent ts-morph Project instance for lightning fast watch-mode AST caching. */
    projectInstance?: Project;
    /** When true, validate existing specs without writing anything to disk. */
    validate?: boolean;
}
declare function runGenerate(configPath: string, options?: RunGenerateOptions): Promise<void>;

export { type AppTypeSnapshotPath as A, type GenerateParams as G, type HonoDocsConfig as H, type OpenApiPath as O, type RouteSource as R, type ApiGroup as a, type RunGenerateOptions as b, runGenerate as r };
