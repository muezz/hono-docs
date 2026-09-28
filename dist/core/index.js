// src/core/runGenerate.ts
import fs3 from "fs";
import path3, { resolve as resolve3 } from "path";
import yaml from "yaml";

// src/utils/constants.ts
var HONO_METHOD_NAMES = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "all"
];
var HONO_METHODS = new Set(HONO_METHOD_NAMES);
var VALIDATOR_TARGETS = [
  "json",
  "form",
  "query",
  "param",
  "header",
  "cookie"
];
var PROJECT_CACHE_DIR_NAME = ".hono-docs";
var OPENAPI_VERSIONS = {
  v3_0: "3.0.3",
  v3_1: "3.1.0"
};
var ZOD_TARGETS = {
  v3_0: "openapi-3.0",
  v3_1: "openapi-3.1",
  jsonSchema7: "jsonSchema7"
};
var VALIBOT_TARGETS = {
  openapi30: "openapi-3.0",
  draft2020: "draft-2020-12",
  draft07: "draft-07"
};
var ZOD_TO_VALIBOT_TARGET_MAP = {
  [ZOD_TARGETS.v3_0]: VALIBOT_TARGETS.openapi30,
  [ZOD_TARGETS.v3_1]: VALIBOT_TARGETS.draft2020,
  [ZOD_TARGETS.jsonSchema7]: VALIBOT_TARGETS.draft07
};

// src/core/runGenerate.ts
import { Project as Project3 } from "ts-morph";

// src/config/loadConfig.ts
import { resolve as resolve2 } from "path";
import { existsSync } from "fs";

// src/utils/libDir.ts
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
function getLibDir() {
  if (typeof __dirname !== "undefined") {
    return resolve(__dirname, "../../");
  }
  const __filename = fileURLToPath(import.meta.url);
  const __dirnameEsm = dirname(__filename);
  return resolve(__dirnameEsm, "../../");
}
function unwrapModule(module) {
  let result = module;
  while (result && typeof result === "object" && "default" in result) {
    const def = result.default;
    if (def === result) break;
    result = def;
  }
  return result;
}

// src/config/loadConfig.ts
import { pathToFileURL } from "url";
async function loadConfig(configFile) {
  const fullPath = resolve2(process.cwd(), configFile);
  if (!existsSync(fullPath)) {
    throw new Error(`[hono-docs] Config file not found: ${fullPath}`);
  }
  let configModule = null;
  try {
    const { createJiti: createJiti2 } = await import("jiti");
    const jiti = createJiti2(import.meta.url, { moduleCache: false });
    configModule = await jiti.import(pathToFileURL(fullPath).href, {
      default: true
    });
  } catch (err) {
    throw new Error(
      `[hono-docs] Failed to load config: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const config = unwrapModule(configModule);
  if (!config || typeof config !== "object") {
    throw new Error(
      `[hono-docs] Invalid config file. Expected an object, got: ${typeof config}`
    );
  }
  const c2 = config;
  if (!c2.outputs || !c2.outputs.openApiJson && !c2.outputs.openApiYaml) {
    throw new Error(
      "[hono-docs] Invalid config: `outputs` must be defined and specify at least one of `openApiJson` or `openApiYaml`."
    );
  }
  return config;
}

// src/core/generateTypes.ts
import fs from "fs";
import path from "path";
import { Project } from "ts-morph";

// src/utils/format.ts
function sanitizeApiPrefix(prefix) {
  return prefix.replace(/^\//, "").split(/[^a-z0-9]+/i).filter(Boolean).map(
    (seg, i) => i === 0 ? seg.toLowerCase() : seg[0].toUpperCase() + seg.slice(1).toLowerCase()
  ).join("");
}
function unwrapUnion(type) {
  return type.isUnion() ? type.getUnionTypes() : [type];
}
function normalizeImportPaths(typeText) {
  return typeText.replace(/from ["'].*node_modules\/(.*)["']/g, `from "$1"`);
}
function cleanDefaultResponse(operation) {
  var _a;
  const defaultResponse = (_a = operation.responses) == null ? void 0 : _a.default;
  if (!defaultResponse) return;
  const defResp = defaultResponse;
  const desc = defResp.description ?? "";
  if (desc.includes("import(")) {
    const content = defResp.content;
    if (content && Object.keys(content).length > 0) {
      defResp.description = "Default fallback response";
    } else {
      delete operation.responses.default;
    }
  }
}
function groupBy(arr, fn) {
  return arr.reduce(
    (acc, x) => {
      (acc[fn(x)] ||= []).push(x);
      return acc;
    },
    {}
  );
}
function generateDefaultSummary(httpMethod, routePath) {
  const cleanPath = routePath.replace(/^\/api(\/v\d+)?/i, "").replace(/\/+/g, "/").replace(/\/$/, "");
  if (!cleanPath || cleanPath === "/") {
    const verb2 = httpMethod.toUpperCase() === "GET" ? "Get" : httpMethod.toUpperCase();
    return `${verb2} Root`;
  }
  const segments = cleanPath.split("/").filter(Boolean);
  const words = [];
  const method = httpMethod.toUpperCase();
  let verb = "Get";
  if (method === "POST") verb = "Create";
  else if (method === "PUT" || method === "PATCH") verb = "Update";
  else if (method === "DELETE") verb = "Delete";
  else verb = method.charAt(0) + method.slice(1).toLowerCase();
  words.push(verb);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith(":") || seg.startsWith("{") && seg.endsWith("}") || seg === "*") {
      let paramName = seg;
      if (seg.startsWith(":")) {
        paramName = seg.slice(1);
      } else if (seg.startsWith("{")) {
        paramName = seg.slice(1, -1);
      } else if (seg === "*") {
        paramName = "Wildcard";
      }
      paramName = paramName.split("{")[0];
      paramName = paramName.replace(/[^a-zA-Z0-9]+$/, "");
      const formattedParam = paramName.replace(/([A-Z])/g, " $1").trim();
      words.push(
        `By ${formattedParam.charAt(0).toUpperCase() + formattedParam.slice(1)}`
      );
    } else {
      const formattedSeg = seg.replace(/[-_]+/g, " ").replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
      words.push(formattedSeg.charAt(0).toUpperCase() + formattedSeg.slice(1));
    }
  }
  return words.join(" ").replace(/\s+/g, " ").trim();
}

// src/core/generateTypes.ts
async function generateTypes({
  config,
  rootPath,
  apiGroup,
  fileName
}) {
  const outputRoot = path.resolve(rootPath, PROJECT_CACHE_DIR_NAME, "types");
  fs.mkdirSync(outputRoot, { recursive: true });
  const outputPath = path.join(outputRoot, `${fileName}.d.ts`);
  const absInput = path.resolve(rootPath, apiGroup.appTypePath);
  const typeProject = new Project({
    tsConfigFilePath: path.resolve(rootPath, config.tsConfigPath)
  });
  const sourceFile = typeProject.addSourceFileAtPath(absInput);
  const typeAliases = sourceFile.getTypeAliases();
  const interfaces = sourceFile.getInterfaces();
  let result = `// AUTO-GENERATED from ${apiGroup.appTypePath}

`;
  typeAliases.forEach((alias) => {
    const raw = alias.getType().getText(alias);
    const clean = normalizeImportPaths(raw);
    result += `export type ${alias.getName()} = ${clean};

`;
  });
  interfaces.forEach((intf) => {
    result += intf.getText() + "\n\n";
  });
  const preContent = config.preDefineTypeContent || "";
  fs.writeFileSync(outputPath, `${preContent}
${result}`, "utf-8");
  return { appTypePath: outputPath, name: fileName };
}

// src/core/generateOpenApi.ts
import fs2 from "fs";
import path2 from "path";
import {
  SyntaxKind as SyntaxKind6
} from "ts-morph";

// src/utils/jsdoc.ts
import { SyntaxKind, ts } from "ts-morph";
function extractJSDocs(project) {
  var _a;
  const map = /* @__PURE__ */ new Map();
  const routeMounts = /* @__PURE__ */ new Map();
  for (const sourceFile of project.getSourceFiles()) {
    if (!sourceFile.getFullText().includes(".route(")) continue;
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === "route") {
        const args = call.getArguments();
        if (args.length === 2 && args[0].isKind(SyntaxKind.StringLiteral)) {
          const prefix = args[0].getLiteralText().replace(/\/+$/, "");
          const routerVarRaw = args[1].getText().trim();
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(routerVarRaw)) {
            const existing = routeMounts.get(routerVarRaw) ?? [];
            routeMounts.set(routerVarRaw, [...existing, prefix]);
          }
        }
      }
    }
  }
  const quickCheckRegex = /\.(get|post|put|delete|patch|all|options|head)\s*\(/i;
  for (const sourceFile of project.getSourceFiles()) {
    if (!quickCheckRegex.test(sourceFile.getFullText())) continue;
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const expr = call.getExpression();
      if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
        const name = expr.getName();
        if (HONO_METHODS.has(name)) {
          const args = call.getArguments();
          if (args.length > 0 && args[0].isKind(SyntaxKind.StringLiteral)) {
            const routePath = args[0].getLiteralText();
            const dotToken = expr.getChildAtIndex(1);
            if (dotToken) {
              const comments = dotToken.getLeadingCommentRanges();
              let comment = "";
              for (let i = comments.length - 1; i >= 0; i--) {
                const c2 = comments[i];
                if (c2.getKind() === SyntaxKind.MultiLineCommentTrivia) {
                  const text = c2.getText();
                  if (text.startsWith("/**") && !text.startsWith("/**/")) {
                    comment = text;
                    break;
                  }
                }
              }
              if (comment) {
                const tsCompiler = ts;
                const jsdocBlock = tsCompiler.parseIsolatedJSDocComment(comment);
                if (jsdocBlock && jsdocBlock.jsDoc) {
                  const doc = jsdocBlock.jsDoc;
                  const parsed = { tags: [] };
                  if (typeof doc.comment === "string" && doc.comment.trim()) {
                    const lines = doc.comment.trim().split("\n");
                    parsed.summary = lines[0].trim();
                    if (lines.length > 1) {
                      parsed.description = lines.slice(1).join("\n").trim();
                    }
                  }
                  (_a = doc.tags) == null ? void 0 : _a.forEach((tag) => {
                    const tagName = tag.tagName.text;
                    const tagComment = typeof tag.comment === "string" ? tag.comment.trim() : "";
                    if (tagName === "summary") {
                      parsed.summary = tagComment;
                    } else if (tagName === "description") {
                      parsed.description = tagComment;
                    } else if (tagName === "tag" && tagComment) {
                      parsed.tags.push(tagComment);
                    } else if (["ignore", "exclude", "hide"].includes(tagName)) {
                      parsed.exclude = true;
                    } else if (tagName.toLowerCase() === "deprecated") {
                      parsed.deprecated = tagComment || true;
                    } else if (tagName.toLowerCase() === "example" && tagComment) {
                      if (!parsed.examples) parsed.examples = [];
                      let statusCode;
                      let rawContent = tagComment;
                      const statusMatch = rawContent.match(
                        /^(?:\[?(\d{3}|default)\]?)\s+([\s\S]*)$/
                      );
                      if (statusMatch) {
                        statusCode = statusMatch[1];
                        rawContent = statusMatch[2].trim();
                      }
                      let value = rawContent;
                      try {
                        value = JSON.parse(rawContent);
                      } catch {
                      }
                      parsed.examples.push({ statusCode, value });
                    } else if ((tagName.toLowerCase() === "responsedescription" || tagName.toLowerCase() === "response_description") && tagComment) {
                      const match = tagComment.match(/^(\d{3}|default)\s+(.*)$/);
                      if (match) {
                        const statusCode = match[1];
                        const desc = match[2].trim();
                        if (!parsed.responseDescriptions)
                          parsed.responseDescriptions = {};
                        parsed.responseDescriptions[statusCode] = desc;
                      }
                    } else if (tagName.toLowerCase() === "responseheader" && tagComment) {
                      const match = tagComment.match(
                        /^(\d{3})\s+([a-zA-Z0-9\-_]+)(?:\s+\[([a-zA-Z]+)\])?(?:\s+(.*))?$/
                      );
                      if (match) {
                        const statusCode = match[1];
                        const headerName = match[2];
                        const type = match[3] || "string";
                        const description = match[4] || "";
                        if (!parsed.responseHeaders)
                          parsed.responseHeaders = {};
                        if (!parsed.responseHeaders[statusCode])
                          parsed.responseHeaders[statusCode] = [];
                        const headerObj = {
                          schema: type === "array" ? { type: "array", items: { type: "string" } } : {
                            type
                          }
                        };
                        if (description) {
                          headerObj.description = description;
                        }
                        parsed.responseHeaders[statusCode].push({
                          name: headerName,
                          schema: headerObj
                        });
                      }
                    }
                  });
                  let openApiPath = routePath.replace(/:([^/]+)/g, "{$1}");
                  const varDecl = call.getFirstAncestorByKind(
                    SyntaxKind.VariableDeclaration
                  );
                  if (varDecl) {
                    const routerName = varDecl.getName();
                    const prefixes = routeMounts.get(routerName);
                    if (prefixes && prefixes.length > 0) {
                      const prefix = prefixes[0];
                      openApiPath = prefix + (openApiPath === "/" ? "" : openApiPath);
                    }
                  }
                  const key = `${name.toLowerCase()} ${openApiPath}`;
                  if (!map.has(key)) {
                    map.set(key, []);
                  }
                  map.get(key).push(parsed);
                  if (varDecl) {
                    const prefixes2 = routeMounts.get(varDecl.getName());
                    if (prefixes2 && prefixes2.length > 1) {
                      const baseOpenApiPath = routePath.replace(
                        /:([^/]+)/g,
                        "{$1}"
                      );
                      for (const extraPrefix of prefixes2.slice(1)) {
                        const extraPath = extraPrefix + (baseOpenApiPath === "/" ? "" : baseOpenApiPath);
                        const extraKey = `${name.toLowerCase()} ${extraPath}`;
                        if (!map.has(extraKey)) map.set(extraKey, []);
                        map.get(extraKey).push(parsed);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return map;
}

// src/utils/schemaHelper.ts
var X_SCHEMA_NAME = "x-schema-name";
function attachSchemaName(schema, name) {
  if (name && name !== "default" && schema && typeof schema === "object") {
    if (!schema[X_SCHEMA_NAME]) {
      schema[X_SCHEMA_NAME] = name;
    }
  }
}

// src/openapi/adapters/v3-0.ts
var v30Adapter = {
  version: OPENAPI_VERSIONS.v3_0,
  zodTarget: ZOD_TARGETS.v3_0,
  makeNullable(schema) {
    return { ...schema, nullable: true };
  },
  makeDocumentRoot(base) {
    return {
      openapi: OPENAPI_VERSIONS.v3_0,
      ...base
    };
  }
};

// src/utils/buildSchema.ts
function buildSchema({
  type,
  typeChecker,
  contextNode,
  seen = /* @__PURE__ */ new WeakSet(),
  depth = 0,
  adapter = v30Adapter
}) {
  if (depth > 40) return {};
  const isComplex = type.isObject() || type.isArray() || type.isTuple();
  if (isComplex) {
    if (seen.has(type)) return {};
    seen.add(type);
  }
  const symbol = type.getSymbol() || type.getAliasSymbol();
  if (symbol && symbol.getName() === "Date") {
    return {
      type: "string",
      format: "date-time"
    };
  }
  if (type.isStringLiteral && type.isStringLiteral()) {
    return {
      type: "string",
      enum: [type.getLiteralValue()]
    };
  }
  if (type.isNumberLiteral && type.isNumberLiteral()) {
    return {
      type: "number",
      enum: [type.getLiteralValue()]
    };
  }
  const text = type.getText();
  if (text === "true" || text === "false") {
    return {
      type: "boolean",
      enum: [text === "true"]
    };
  }
  if (type.isUnion()) {
    const members = type.getUnionTypes();
    const hasTrue = members.some((m) => m.getText() === "true");
    const hasFalse = members.some((m) => m.getText() === "false");
    const onlyBools = members.every(
      (m) => m.getText() === "true" || m.getText() === "false" || m.isNull && m.isNull() || m.isUndefined && m.isUndefined()
    );
    if (hasTrue && hasFalse && onlyBools) {
      const schema = { type: "boolean" };
      if (members.some((m) => m.isNull && m.isNull())) {
        return adapter.makeNullable(schema);
      }
      return schema;
    }
    const lits = members.filter(
      (u) => u.isStringLiteral && u.isStringLiteral()
    );
    const onlyNull = members.every(
      (u) => u.isStringLiteral && u.isStringLiteral() || u.isNull && u.isNull() || u.isUndefined && u.isUndefined()
    );
    if (lits.length && onlyNull) {
      const schema = {
        type: "string",
        enum: lits.map((u) => String(u.getLiteralValue()))
      };
      if (members.some((u) => u.isNull && u.isNull())) {
        return adapter.makeNullable(schema);
      }
      return schema;
    }
    const hasNull = members.some((u) => u.isNull && u.isNull());
    const nonNull = members.filter(
      (u) => !(u.isNull && u.isNull()) && !(u.isUndefined && u.isUndefined())
    );
    let resultSchema;
    if (nonNull.length === 1) {
      resultSchema = buildSchema({
        type: nonNull[0],
        typeChecker,
        contextNode,
        seen,
        depth: depth + 1,
        adapter
      });
    } else {
      resultSchema = {
        oneOf: nonNull.map(
          (u) => buildSchema({
            type: u,
            typeChecker,
            contextNode,
            seen,
            depth: depth + 1,
            adapter
          })
        )
      };
    }
    if (hasNull && typeof resultSchema === "object") {
      return adapter.makeNullable(
        resultSchema
      );
    }
    return resultSchema;
  }
  if (type.isIntersection()) {
    return {
      allOf: type.getIntersectionTypes().map(
        (t) => buildSchema({
          type: t,
          typeChecker,
          contextNode,
          seen,
          depth: depth + 1,
          adapter
        })
      )
    };
  }
  if (type.isString()) return { type: "string" };
  if (type.isNumber()) return { type: "number" };
  if (type.isBoolean()) return { type: "boolean" };
  if (type.isArray()) {
    return {
      type: "array",
      items: buildSchema({
        type: type.getArrayElementTypeOrThrow(),
        typeChecker,
        contextNode,
        seen,
        depth: depth + 1,
        adapter
      })
    };
  }
  if (type.isTuple()) {
    return {
      type: "array",
      items: {
        oneOf: type.getTupleElements().map(
          (el) => buildSchema({
            type: el,
            typeChecker,
            contextNode,
            seen,
            depth: depth + 1,
            adapter
          })
        )
      },
      minItems: type.getTupleElements().length,
      maxItems: type.getTupleElements().length
    };
  }
  if (type.isObject()) {
    const props = type.getProperties();
    const filteredProps = props.filter((p) => {
      const name = p.getName();
      return !name.startsWith("__@") && !name.startsWith("Symbol(");
    });
    const propsMap = {};
    const req = [];
    for (const p of filteredProps) {
      const pType = typeChecker.getTypeOfSymbolAtLocation(p, contextNode);
      propsMap[p.getName()] = buildSchema({
        type: pType,
        typeChecker,
        contextNode,
        seen,
        depth: depth + 1,
        adapter
      });
      if (!p.isOptional()) req.push(p.getName());
    }
    const res = {
      type: "object"
    };
    if (Object.keys(propsMap).length > 0) {
      res.properties = propsMap;
    }
    if (req.length) res.required = req;
    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();
    if (stringIndexType) {
      res.additionalProperties = buildSchema({
        type: stringIndexType,
        typeChecker,
        contextNode,
        seen,
        depth: depth + 1,
        adapter
      });
    } else if (numberIndexType) {
      res.additionalProperties = buildSchema({
        type: numberIndexType,
        typeChecker,
        contextNode,
        seen,
        depth: depth + 1,
        adapter
      });
    }
    const objSymbol = type.getAliasSymbol() || type.getSymbol();
    if (objSymbol) {
      const symName = objSymbol.getName();
      if (symName && !symName.startsWith("__") && symName !== "Object" && symName !== "Record" && symName !== "Partial" && symName !== "Required" && symName !== "Readonly" && symName !== "Pick" && symName !== "Omit") {
        attachSchemaName(res, symName);
      }
    }
    return res;
  }
  return {};
}

// src/schema-resolver/routeIndex.ts
import { SyntaxKind as SyntaxKind2 } from "ts-morph";

// src/schema-resolver/routeScoring.ts
function calculateRelevanceScore(targetSegments, sourceFilePath) {
  const fileSegments = sourceFilePath.toLowerCase().split(/[/\\]/);
  const relevantFileSegments = fileSegments.slice(-5);
  return targetSegments.reduce((acc, seg) => {
    if (seg.length <= 2) {
      return acc + (relevantFileSegments.some(
        (fs5) => fs5 === seg || fs5.startsWith(`${seg}.`)
      ) ? 1 : 0);
    }
    return acc + (relevantFileSegments.some((fs5) => fs5.includes(seg)) ? 1 : 0);
  }, 0);
}

// src/schema-resolver/routeIndex.ts
function normalizeToHonoPath(openApiPath) {
  return openApiPath.replace(/\{([^}]+)\}/g, ":$1");
}
var RouteASTIndex = class {
  constructor(project) {
    this.routes = [];
    this.exactMap = /* @__PURE__ */ new Map();
    this.buildIndex(project);
  }
  buildIndex(project) {
    const quickCheckRegex = /\.(get|post|put|delete|patch|all|options|head)\s*\(/i;
    for (const sourceFile of project.getSourceFiles()) {
      const text = sourceFile.getFullText();
      if (!quickCheckRegex.test(text)) {
        continue;
      }
      const filePath = sourceFile.getFilePath();
      const calls = sourceFile.getDescendantsOfKind(SyntaxKind2.CallExpression);
      for (const call of calls) {
        const expr = call.getExpression();
        if (!expr.isKind(SyntaxKind2.PropertyAccessExpression)) continue;
        const methodName = expr.getName();
        if (!HONO_METHODS.has(methodName)) continue;
        const args = call.getArguments();
        if (args.length === 0) continue;
        const firstArg = args[0];
        if (!firstArg.isKind(SyntaxKind2.StringLiteral) && !firstArg.isKind(SyntaxKind2.NoSubstitutionTemplateLiteral)) {
          continue;
        }
        const rawPath = firstArg.getText().replace(/^['"`]|['"`]$/g, "");
        const item = {
          call,
          sourceFilePath: filePath,
          method: methodName,
          rawPath
        };
        this.routes.push(item);
        const key = `${methodName}:${rawPath}`;
        const existing = this.exactMap.get(key) || [];
        existing.push(item);
        this.exactMap.set(key, existing);
      }
    }
  }
  locate(method, routePath) {
    const targetPath = normalizeToHonoPath(routePath);
    const exactKey = `${method}:${targetPath}`;
    const exact = this.exactMap.get(exactKey);
    if (exact && exact.length > 0) {
      return exact[0];
    }
    const allExact = this.exactMap.get(`all:${targetPath}`);
    if (allExact && allExact.length > 0) {
      return allExact[0];
    }
    const candidates = [];
    const rootFallbacks = [];
    for (const r of this.routes) {
      if (r.method !== method && r.method !== "all") continue;
      if (r.rawPath !== "/" && targetPath.endsWith(r.rawPath)) {
        candidates.push(r);
      } else if (r.rawPath === "/" && !targetPath.includes(":") && !targetPath.includes("{")) {
        rootFallbacks.push(r);
      }
    }
    const targetSegments = targetPath.toLowerCase().split("/").filter(Boolean);
    if (candidates.length === 1) {
      return candidates[0];
    } else if (candidates.length > 1) {
      candidates.sort((a, b) => {
        if (b.rawPath.length !== a.rawPath.length) {
          return b.rawPath.length - a.rawPath.length;
        }
        const scoreA = calculateRelevanceScore(
          targetSegments,
          a.sourceFilePath
        );
        const scoreB = calculateRelevanceScore(
          targetSegments,
          b.sourceFilePath
        );
        return scoreB - scoreA;
      });
      return candidates[0];
    }
    if (rootFallbacks.length === 1) {
      return rootFallbacks[0];
    } else if (rootFallbacks.length > 1) {
      rootFallbacks.sort((a, b) => {
        const scoreA = calculateRelevanceScore(
          targetSegments,
          a.sourceFilePath
        );
        const scoreB = calculateRelevanceScore(
          targetSegments,
          b.sourceFilePath
        );
        return scoreB - scoreA;
      });
      return rootFallbacks[0];
    }
    return null;
  }
};
var indexCache = /* @__PURE__ */ new WeakMap();
function getProjectRouteIndex(project) {
  let idx = indexCache.get(project);
  if (!idx) {
    idx = new RouteASTIndex(project);
    indexCache.set(project, idx);
  }
  return idx;
}
function invalidateProjectIndex(project) {
  indexCache.delete(project);
}
function locateRouteEntry(method, routePath, project) {
  const index = getProjectRouteIndex(project);
  return index.locate(method, routePath);
}

// src/schema-resolver/locateRouteNode.ts
function locateRouteNode(method, routePath, project) {
  const entry = locateRouteEntry(method, routePath, project);
  return entry ? entry.call : null;
}

// src/schema-resolver/detectSchemaArg.ts
import {
  SyntaxKind as SyntaxKind3
} from "ts-morph";

// src/schema-resolver/detectLibrary.ts
function detectLibrary(type) {
  const typeText = type.getText();
  if (type.getProperty("safeParse") || type.getProperty("_def") || /\bZod(Type|Object|String|Number|Boolean|Array|Enum|Union|Discriminated|Effects|Schema|Base)\b/.test(typeText)) {
    return "zod";
  }
  if (type.getProperty("_run") || type.getProperty("~run") || type.getProperty("_types") || type.getProperty("~types") || /\b(BaseSchema|GenericSchema|ObjectSchema|ArraySchema|StringSchema|NumberSchema)\b/.test(typeText)) {
    return "valibot";
  }
  const hasStatic = type.getProperty("static") || type.getProperties().some((p) => p.getName() === "static");
  if (hasStatic && (typeText.includes("TSchema") || typeText.includes("TObject") || typeText.includes("TString"))) {
    return "typebox";
  }
  if (type.getProperty("validate") && type.getProperty("validateSync")) {
    return "yup";
  }
  if (type.getProperty("toJsonSchema") && type.getProperty("infer") && type.getProperty("~standard")) {
    return "arktype";
  }
  return "unsupported";
}

// src/schema-resolver/detectSchemaArg.ts
function detectSchemaArgs(routeCall, typeChecker) {
  const results = [];
  const args = routeCall.getArguments();
  if (args.length < 2) return results;
  const middlewareArgs = args.slice(1, -1);
  for (const arg of middlewareArgs) {
    const directType = typeChecker.getTypeAtLocation(arg);
    const directLib = detectLibrary(directType);
    if (directLib !== "unsupported") {
      results.push({ node: arg, library: directLib, target: "json" });
      continue;
    }
    if (arg.isKind(SyntaxKind3.CallExpression)) {
      const middlewareCall = arg.asKindOrThrow(SyntaxKind3.CallExpression);
      const innerArgs = middlewareCall.getArguments();
      let target = "json";
      let schemaNode = null;
      for (const innerArg of innerArgs) {
        if (innerArg.isKind(SyntaxKind3.StringLiteral)) {
          const val = innerArg.getText().replace(/^['"`]|['"`]$/g, "");
          if (VALIDATOR_TARGETS.includes(val)) {
            target = val;
            continue;
          }
        }
        const innerType = typeChecker.getTypeAtLocation(innerArg);
        const lib = detectLibrary(innerType);
        if (lib !== "unsupported") {
          schemaNode = innerArg;
          results.push({ node: schemaNode, library: lib, target });
          break;
        }
      }
    }
  }
  return results;
}

// src/schema-resolver/traceDeclaration.ts
import { SyntaxKind as SyntaxKind4 } from "ts-morph";
function traceDeclaration(schemaNode) {
  try {
    const symbol = schemaNode.isKind(SyntaxKind4.Identifier) ? schemaNode.getSymbol() : schemaNode.getType().getSymbol() ?? schemaNode.getType().getAliasSymbol();
    if (!symbol) return null;
    let resolved = symbol;
    for (let i = 0; i < 5; i++) {
      const aliased = resolved.getAliasedSymbol();
      if (!aliased) break;
      resolved = aliased;
    }
    const declarations = resolved.getDeclarations();
    if (!declarations.length) return null;
    const decl = declarations[0];
    const sourceFile = decl.getSourceFile();
    const filePath = sourceFile.getFilePath();
    let exportName = "default";
    if (decl.isKind(SyntaxKind4.VariableDeclaration)) {
      exportName = decl.getName();
    } else if (decl.isKind(SyntaxKind4.ExportSpecifier)) {
      exportName = decl.getName();
    } else if (decl.isKind(SyntaxKind4.ImportSpecifier)) {
      exportName = decl.getName();
    } else if (decl.isKind(SyntaxKind4.BindingElement)) {
      exportName = decl.getName();
    }
    return { filePath, exportName };
  } catch {
    return null;
  }
}

// src/schema-resolver/loadSchema.ts
import { createJiti } from "jiti";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname as dirname2 } from "path";
import { randomUUID } from "crypto";
async function loadLiveSchema(filePath, exportName, cwd) {
  const jiti = createJiti(cwd, {
    interopDefault: false,
    moduleCache: false
  });
  try {
    const mod = await jiti.import(filePath);
    if (mod && typeof mod === "object") {
      if (Object.prototype.hasOwnProperty.call(mod, exportName)) {
        const val = mod[exportName];
        if (val !== null && val !== void 0) return val;
      }
    }
  } catch {
  }
  const tempId = randomUUID().replace(/-/g, "");
  const tempFile = join(dirname2(filePath), `__hono_docs_temp_${tempId}.ts`);
  try {
    const originalSource = readFileSync(filePath, "utf-8");
    const wrappedSource = `${originalSource}
export { ${exportName} as __target__ };
`;
    writeFileSync(tempFile, wrappedSource, "utf-8");
    const tempMod = await jiti.import(tempFile);
    if (tempMod && Object.prototype.hasOwnProperty.call(tempMod, "__target__")) {
      return tempMod["__target__"] ?? null;
    }
    return null;
  } catch {
    return null;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
    }
  }
}

// src/schema-resolver/converters/zodConverter.ts
import { zodToJsonSchema } from "zod-to-json-schema";
async function convertZodSchema(schema, cwd, zodTarget = ZOD_TARGETS.v3_0) {
  var _a, _b;
  try {
    const zodSchema = schema;
    if (!zodSchema || typeof zodSchema !== "object" || !zodSchema._def) {
      return null;
    }
    const { createJiti: createJiti2 } = await import("jiti");
    const jiti = createJiti2(cwd, { interopDefault: true });
    let zodModule = null;
    try {
      zodModule = jiti("zod");
    } catch {
      return null;
    }
    const toJSONSchema = (zodModule == null ? void 0 : zodModule.toJSONSchema) ?? ((_a = zodModule == null ? void 0 : zodModule.z) == null ? void 0 : _a.toJSONSchema) ?? ((_b = zodModule == null ? void 0 : zodModule.default) == null ? void 0 : _b.toJSONSchema);
    if (typeof toJSONSchema === "function") {
      const result = toJSONSchema(zodSchema, {
        target: zodTarget,
        // Map unrepresentable types (bigint, custom) to {}
        unrepresentable: "any",
        errorMessages: true
      });
      if (result && typeof result === "object") {
        const { $schema: _schema, ...clean } = result;
        return clean;
      }
      return result ?? null;
    }
    try {
      const converter = zodToJsonSchema;
      let fallbackTarget = "openApi3";
      if (zodTarget === ZOD_TARGETS.v3_1)
        fallbackTarget = ZOD_TARGETS.jsonSchema7;
      else if (zodTarget === ZOD_TARGETS.jsonSchema7)
        fallbackTarget = ZOD_TARGETS.jsonSchema7;
      const res = converter(zodSchema, {
        target: fallbackTarget,
        errorMessages: true
      });
      if (res && typeof res === "object") {
        const { $schema: _schema, ...clean } = res;
        return clean;
      }
    } catch {
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

// src/schema-resolver/converters/valibotConverter.ts
async function convertValibotSchema(schema, cwd, targetFormat) {
  var _a;
  try {
    const valibotSchema = schema;
    if (!valibotSchema || typeof valibotSchema !== "object" || !(valibotSchema._run || valibotSchema["~run"])) {
      return null;
    }
    const { createJiti: createJiti2 } = await import("jiti");
    const jiti = createJiti2(cwd, { interopDefault: true });
    let toJsonSchema;
    try {
      const mod = jiti("@valibot/to-json-schema");
      toJsonSchema = (mod == null ? void 0 : mod.toJsonSchema) ?? ((_a = mod == null ? void 0 : mod.default) == null ? void 0 : _a.toJsonSchema);
    } catch {
      return null;
    }
    if (typeof toJsonSchema !== "function") return null;
    const valibotTarget = ZOD_TO_VALIBOT_TARGET_MAP[targetFormat] ?? VALIBOT_TARGETS.openapi30;
    const result = toJsonSchema(valibotSchema, {
      // Use input type for transforms
      typeMode: "input",
      target: valibotTarget
    });
    if (result && typeof result === "object") {
      const { $schema: _schema, ...clean } = result;
      return clean;
    }
    return result ?? null;
  } catch {
    return null;
  }
}

// src/schema-resolver/converters/typeboxConverter.ts
var TYPEBOX_KIND_KEY = /* @__PURE__ */ Symbol.for("TypeBox.Kind");
function convertTypeBoxSchema(schema) {
  try {
    const tbSchema = schema;
    if (!tbSchema || typeof tbSchema !== "object" || !(TYPEBOX_KIND_KEY in tbSchema)) {
      return null;
    }
    return stripTypeBoxMeta(tbSchema);
  } catch {
    return null;
  }
}
function stripTypeBoxMeta(schema) {
  if (Array.isArray(schema)) {
    return schema.map(stripTypeBoxMeta);
  }
  if (typeof schema !== "object" || schema === null) return schema;
  const result = {};
  for (const key of Object.keys(schema)) {
    if (key === "static") continue;
    const val = schema[key];
    if (typeof val === "object" && val !== null) {
      result[key] = stripTypeBoxMeta(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// src/schema-resolver/converters/arktypeConverter.ts
function convertArktypeSchema(schema) {
  try {
    const arkSchema = schema;
    if (!arkSchema || typeof arkSchema !== "object" && typeof arkSchema !== "function" || typeof arkSchema.toJsonSchema !== "function") {
      return null;
    }
    const result = arkSchema.toJsonSchema();
    if (result && typeof result === "object") {
      const { $schema: _schema, ...clean } = result;
      return clean;
    }
    return null;
  } catch {
    return null;
  }
}

// src/schema-resolver/index.ts
async function resolveValidatorSchema(routePath, method, target, project, typeChecker, rootPath, cacheManager, adapter = v30Adapter) {
  try {
    const routeNode = locateRouteNode(method, routePath, project);
    if (!routeNode) return null;
    const schemaArgs = detectSchemaArgs(routeNode, typeChecker);
    if (!schemaArgs.length) return null;
    const match = schemaArgs.find((s) => s.target === target);
    if (!match) return null;
    const library = match.library;
    const traceResult = traceDeclaration(match.node);
    if (!traceResult) return null;
    let schemaKey = "";
    if (cacheManager) {
      let fileHash = "";
      const sf = project.getSourceFile(traceResult.filePath);
      if (sf) {
        const deps = /* @__PURE__ */ new Set([traceResult.filePath]);
        const queue = [sf];
        while (queue.length > 0) {
          const curr = queue.pop();
          for (const ref of curr.getReferencedSourceFiles()) {
            const refPath = ref.getFilePath();
            if (!refPath.includes("node_modules") && !deps.has(refPath)) {
              deps.add(refPath);
              queue.push(ref);
            }
          }
        }
        fileHash = cacheManager.hashGroup(Array.from(deps));
      } else {
        fileHash = cacheManager.hashFile(traceResult.filePath);
      }
      schemaKey = `${fileHash}:${traceResult.exportName}:${library}`;
      const cached = cacheManager.getSchemaCache(schemaKey);
      if (cached) {
        attachSchemaName(cached, traceResult.exportName);
        return { source: "dynamic", library, schema: cached };
      }
    }
    const liveSchema = await loadLiveSchema(
      traceResult.filePath,
      traceResult.exportName,
      rootPath
    );
    if (!liveSchema) return null;
    let schema = null;
    switch (library) {
      case "zod":
        schema = await convertZodSchema(
          liveSchema,
          rootPath,
          adapter.zodTarget
        );
        break;
      case "valibot":
        schema = await convertValibotSchema(liveSchema, rootPath, adapter.zodTarget);
        break;
      case "typebox":
        schema = convertTypeBoxSchema(
          liveSchema
        );
        break;
      case "arktype":
        schema = convertArktypeSchema(
          liveSchema
        );
        break;
      default:
        return null;
    }
    if (!schema) return null;
    attachSchemaName(schema, traceResult.exportName);
    if (cacheManager && schemaKey) {
      cacheManager.setSchemaCache(schemaKey, schema);
    }
    return { source: "dynamic", library, schema };
  } catch {
    return null;
  }
}

// src/utils/logger.ts
var c = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  white: "\x1B[97m",
  gray: "\x1B[90m",
  cyan: "\x1B[96m",
  green: "\x1B[92m",
  yellow: "\x1B[93m",
  blue: "\x1B[94m",
  magenta: "\x1B[95m",
  red: "\x1B[91m",
  orange: "\x1B[38;5;208m"
};
function col(ansi, text) {
  return `${ansi}${text}${c.reset}`;
}
var METHOD_COLORS = {
  GET: c.bold + c.green,
  POST: c.bold + c.cyan,
  PUT: c.bold + c.yellow,
  PATCH: c.bold + c.orange,
  DELETE: c.bold + c.red,
  HEAD: c.bold + c.blue,
  OPTIONS: c.bold + c.magenta,
  ALL: c.bold + c.gray
};
function formatMethod(method) {
  const ansi = METHOD_COLORS[method.toUpperCase()] ?? c.bold + c.white;
  return col(ansi, method.toUpperCase().padEnd(6));
}
var VALIDATOR_COLORS = {
  zod: c.cyan,
  valibot: c.magenta,
  typebox: c.orange,
  yup: c.yellow,
  "ts type": c.blue,
  arktype: c.green,
  "no input": c.gray,
  unsupported: c.red
};
function formatValidator(lib) {
  const ansi = VALIDATOR_COLORS[lib.toLowerCase()] ?? c.white;
  return col(ansi, lib.toLowerCase());
}
function progressBar(count, total, width = 20) {
  const filled = total === 0 ? 0 : count > 0 ? Math.max(1, Math.round(count / total * width)) : 0;
  return col(c.green, "\u2588".repeat(filled)) + col(c.gray, "\u2591".repeat(width - filled));
}
var _buffer = [];
var _cacheHits = 0;
var _totalGroups = 0;
var logger = {
  /** Print the header banner with version, config, and tsconfig paths. */
  banner(version, configPath, tsConfig) {
    try {
      process.stdout.write("\n");
      process.stdout.write(
        `  ${col(c.bold + c.cyan, "\u25C6  hono-docs")} ${col(c.dim, `v${version}`)}  ${col(c.dim, "\xB7")}  ${col(c.white, configPath)}  ${col(c.dim, "\xB7")}  ${col(c.white, tsConfig)}

`
      );
    } catch {
    }
  },
  /** Print the "🔍 Analyzing routes..." phase header. */
  analyzing() {
    try {
      process.stdout.write(
        `
  \u{1F50D}  ${col(c.bold + c.white, "Analyzing routes...")}

`
      );
    } catch {
    }
  },
  /** Print a cache-hit line for a group that was loaded from cache. */
  cached(groupName) {
    try {
      _cacheHits++;
      process.stdout.write(
        `      ${col(c.bold + c.green, "\u26A1")}  ${col(c.white, groupName.padEnd(44))}  ${col(c.dim, "\u2192  loaded from cache (skipped)")}
`
      );
    } catch {
    }
  },
  /** Track total group count (called once per group, before or after cache check). */
  trackGroup() {
    _totalGroups++;
  },
  /** Register a discovered route before schema evaluation. */
  registerRoute(method, routePath, hasDoc = false) {
    try {
      const m = method.toUpperCase();
      const existing = _buffer.find(
        (r) => r.method === m && r.path === routePath
      );
      if (existing) {
        existing.hasDoc = Boolean(existing.hasDoc || hasDoc);
      } else {
        _buffer.push({ method: m, path: routePath, hasDoc, sources: [] });
      }
    } catch {
    }
  },
  /** Buffer a single enriched route input source — flushed later via logger.summary(). */
  record(method, routePath, source, library) {
    try {
      const m = method.toUpperCase();
      const existing = _buffer.find(
        (r) => r.method === m && r.path === routePath
      );
      if (existing) {
        if (!existing.sources.some(
          (s) => s.src === source && s.library === library
        )) {
          existing.sources.push({ src: source, library });
        }
      } else {
        _buffer.push({
          method: m,
          path: routePath,
          sources: [{ src: source, library }]
        });
      }
    } catch {
    }
  },
  /** Get recorded sources for a specific route (for caching). */
  getRouteSources(method, routePath) {
    try {
      const m = method.toUpperCase();
      const existing = _buffer.find(
        (r) => r.method === m && r.path === routePath
      );
      return existing ? existing.sources : [];
    } catch {
      return [];
    }
  },
  /** Restore recorded sources for a cached route. */
  recordSources(method, routePath, sources, hasDoc = false) {
    try {
      const m = method.toUpperCase();
      const existing = _buffer.find(
        (r) => r.method === m && r.path === routePath
      );
      if (existing) {
        existing.sources = sources;
        existing.hasDoc = Boolean(existing.hasDoc || hasDoc);
      } else {
        _buffer.push({ method: m, path: routePath, hasDoc, sources });
      }
    } catch {
    }
  },
  /** Flush buffered routes + print documentation and schema engine dashboards. */
  summary() {
    try {
      if (_buffer.length === 0) {
        if (_totalGroups > 0 && _cacheHits === _totalGroups) {
          return;
        }
        process.stdout.write(
          `      ${col(c.yellow, "\u{1F4ED}  No API endpoints were discovered in the target application.")}
      ${col(c.dim, "    Please verify your appTypePath in your configuration and check that route types are exported.")}
`
        );
        return;
      }
      for (const { method, path: path5, sources } of _buffer) {
        const truncPath = path5.length > 60 ? path5.slice(0, 30) + "\u2026" + path5.slice(-29) : path5;
        const methodStr = formatMethod(method);
        const pathStr = col(c.white, truncPath.padEnd(60));
        if (sources.length === 0) {
          process.stdout.write(
            `      ${methodStr}  ${pathStr}  ${col(c.dim, "\u2192  no input")}
`
          );
        } else {
          const grouped = {};
          for (const { src, library } of sources) {
            (grouped[library] ??= []).push(src);
          }
          const tagsStr = Object.entries(grouped).map(
            ([lib, srcs]) => `${formatValidator(lib)} ${col(c.dim, srcs.join(" \xB7 "))}`
          ).join(col(c.dim, "  "));
          process.stdout.write(
            `      ${methodStr}  ${pathStr}  ${col(c.dim, "\u2192")}  ${tagsStr}
`
          );
        }
      }
      const total = _buffer.length;
      const methodCounts = {};
      let docCount = 0;
      for (const r of _buffer) {
        methodCounts[r.method] = (methodCounts[r.method] ?? 0) + 1;
        if (r.hasDoc) docCount++;
      }
      const methodOrder = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "HEAD",
        "ALL"
      ];
      const methodParts = Object.entries(methodCounts).sort(
        ([a], [b]) => (methodOrder.indexOf(a) !== -1 ? methodOrder.indexOf(a) : 99) - (methodOrder.indexOf(b) !== -1 ? methodOrder.indexOf(b) : 99)
      ).map(
        ([m, cnt]) => `${col(METHOD_COLORS[m] ?? c.bold + c.white, m)}: ${cnt}`
      ).join(col(c.dim, " \xB7 "));
      const docPercentage = Math.round(docCount / total * 100);
      process.stdout.write(
        `

  \u{1F4CA}  ${col(c.bold + c.white, "Documentation Summary")}

`
      );
      process.stdout.write(
        `      ${col(c.dim, "Endpoints Discovered  :")}  ${col(c.bold + c.white, `${total} total`)}  ${col(c.dim, "(")} ${methodParts} ${col(c.dim, ")")}
`
      );
      process.stdout.write(
        `      ${col(c.dim, "JSDoc Coverage        :")}  ${col(c.white, `${docCount} / ${total} routes documented (${docPercentage}%)`)}
`
      );
      const libCounts = {};
      for (const r of _buffer) {
        if (r.sources.length === 0) {
          libCounts["no input"] = (libCounts["no input"] ?? 0) + 1;
        } else {
          const seen = /* @__PURE__ */ new Set();
          for (const { library } of r.sources) {
            if (!seen.has(library)) {
              libCounts[library] = (libCounts[library] ?? 0) + 1;
              seen.add(library);
            }
          }
        }
      }
      if (Object.keys(libCounts).length > 0) {
        process.stdout.write(
          `

  \u2699\uFE0F  ${col(c.bold + c.white, "Schema Resolution Engine")}

`
        );
        const maxLen = Math.max(...Object.keys(libCounts).map((k) => k.length));
        const libOrder = Object.keys(VALIDATOR_COLORS);
        const sortedLibs = Object.entries(libCounts).sort(([a], [b]) => {
          const ia = libOrder.indexOf(a.toLowerCase());
          const ib = libOrder.indexOf(b.toLowerCase());
          return (ia === -1 ? 50 : ia) - (ib === -1 ? 50 : ib);
        });
        for (const [lib, cnt] of sortedLibs) {
          let label = "(Dynamic)";
          if (lib === "ts type") label = "(Static AST)";
          if (lib === "no input") label = "(No validation required)";
          process.stdout.write(
            `      ${col(VALIDATOR_COLORS[lib.toLowerCase()] ?? c.white, lib.padEnd(maxLen + 2))}${progressBar(cnt, total)}  ${col(c.white, `${cnt} ${cnt === 1 ? "route " : "routes"}`)}  ${col(c.dim, label)}
`
          );
        }
      }
    } catch {
    } finally {
      _buffer.length = 0;
    }
  },
  /** Print the output file path and size. */
  output(outputPath, sizeBytes) {
    try {
      const sizeStr = sizeBytes != null ? col(c.dim, `  ${(sizeBytes / 1024).toFixed(1)} KB`) : "";
      process.stdout.write(
        `

  \u{1F4C4}  ${col(c.bold + c.white, "Output written")}

`
      );
      process.stdout.write(
        `      ${col(c.cyan + c.bold, outputPath)}${sizeStr}
`
      );
    } catch {
    }
  },
  /** Print the final success line with elapsed time and optional cache stats. */
  done(elapsedMs) {
    try {
      let cacheStr = "";
      if (_totalGroups > 0 && _cacheHits > 0) {
        cacheStr = col(
          c.dim,
          `  (${_cacheHits}/${_totalGroups} groups from cache)`
        );
      }
      process.stdout.write(
        `

  ${col(c.bold + c.green, "\u2728  Done")} ${col(c.dim, `in ${elapsedMs}ms`)}${cacheStr}

`
      );
      _cacheHits = 0;
      _totalGroups = 0;
    } catch {
    }
  },
  /** Print a non-fatal warning. */
  warn(message) {
    try {
      process.stdout.write(`  ${col(c.yellow, "\u26A0")}  ${col(c.dim, message)}
`);
    } catch {
    }
  },
  /** Print general info. */
  info(message) {
    try {
      process.stdout.write(
        `
  ${col(c.blue, "\u2139")}  ${col(c.white, message)}
`
      );
    } catch {
    }
  },
  /** Print success status. */
  success(message) {
    try {
      process.stdout.write(`  ${col(c.green, "\u2714")}  ${col(c.dim, message)}
`);
    } catch {
    }
  },
  /** Print a fatal error. */
  error(message, err) {
    try {
      process.stdout.write(
        `
  ${col(c.red, "\u274C")}  ${col(c.bold + c.red, message)}
`
      );
      if (err) {
        process.stdout.write(`      ${col(c.red, String(err))}
`);
      }
    } catch {
    }
  }
};

// src/utils/parameters.ts
function isArraySchema(schema) {
  if ("$ref" in schema) return false;
  if (schema.type === "array") return true;
  if (schema.oneOf) return schema.oneOf.some(isArraySchema);
  if (schema.anyOf) return schema.anyOf.some(isArraySchema);
  return false;
}
async function genParameters(options) {
  const {
    type,
    typeChecker,
    contextNode,
    routePath,
    method,
    project,
    rootPath,
    pathPatterns,
    cacheManager,
    adapter = v30Adapter
  } = options;
  const inputProp = type.getProperty("input");
  if (!inputProp) return [];
  const input = typeChecker.getTypeOfSymbolAtLocation(inputProp, contextNode);
  if (!input) return [];
  const sources = VALIDATOR_TARGETS.filter((t) => t !== "json" && t !== "form");
  const params = [];
  for (const src of sources) {
    const p = input.getProperty(src);
    if (!p) continue;
    let dynamicSchema = null;
    let mergedProperties = {};
    let mergedRequired = [];
    if (routePath && method && project && rootPath) {
      const resolved = await resolveValidatorSchema(
        routePath,
        method,
        src,
        project,
        typeChecker,
        rootPath,
        cacheManager,
        adapter
      );
      if (resolved && resolved.schema && typeof resolved.schema === "object" && !("$ref" in resolved.schema)) {
        if (resolved.schema.properties) {
          dynamicSchema = resolved.schema;
          mergedProperties = resolved.schema.properties;
          mergedRequired = Array.isArray(dynamicSchema.required) ? dynamicSchema.required : [];
          logger.record(method, routePath, src, resolved.library);
        } else if (resolved.schema.allOf) {
          dynamicSchema = resolved.schema;
          const reqSet = /* @__PURE__ */ new Set();
          for (const sub of resolved.schema.allOf) {
            if (typeof sub === "object" && !("$ref" in sub) && sub.properties) {
              Object.assign(mergedProperties, sub.properties);
              if (Array.isArray(sub.required)) {
                sub.required.forEach((r) => reqSet.add(r));
              }
            }
          }
          if (reqSet.size > 0) mergedRequired = Array.from(reqSet);
          logger.record(method, routePath, src, resolved.library);
        }
      }
    }
    if (dynamicSchema) {
      for (const [key, propSchema] of Object.entries(mergedProperties)) {
        const schemaObj = propSchema;
        if (src === "param" && (pathPatterns == null ? void 0 : pathPatterns[key])) {
          schemaObj.pattern = pathPatterns[key];
          if (!schemaObj.type) schemaObj.type = "string";
        }
        const isArray = src === "query" && isArraySchema(schemaObj);
        params.push({
          name: key,
          in: src === "param" ? "path" : src,
          required: src === "param" ? true : mergedRequired.includes(key),
          schema: schemaObj,
          ...isArray ? { style: "form", explode: true } : {}
        });
      }
    } else {
      const srcType = typeChecker.getTypeOfSymbolAtLocation(p, contextNode);
      const props = srcType.getProperties();
      if (props.length > 0 && routePath && method) {
        logger.record(method, routePath, src, "ts type");
      }
      for (const f of props) {
        const ft = typeChecker.getTypeOfSymbolAtLocation(f, contextNode);
        const name = f.getName();
        const schema = buildSchema({
          type: ft,
          typeChecker,
          contextNode,
          adapter
        });
        if (src === "param" && (pathPatterns == null ? void 0 : pathPatterns[name])) {
          schema.pattern = pathPatterns[name];
          if (!schema.type) schema.type = "string";
        }
        const isArray = src === "query" && isArraySchema(schema);
        params.push({
          name,
          in: src === "param" ? "path" : src,
          required: src === "param" ? true : !f.isOptional(),
          schema,
          ...isArray ? { style: "form", explode: true } : {}
        });
      }
    }
  }
  return params;
}

// src/utils/requestBody.ts
async function genRequestBody(options) {
  const {
    type,
    typeChecker,
    contextNode,
    routePath,
    method,
    project,
    rootPath,
    cacheManager,
    adapter = v30Adapter
  } = options;
  const inpProp = type.getProperty("input");
  if (!inpProp) return null;
  const inp = typeChecker.getTypeOfSymbolAtLocation(inpProp, contextNode);
  if (!inp) return null;
  const content = {};
  const jProp = inp.getProperty("json");
  if (jProp) {
    const jType = typeChecker.getTypeOfSymbolAtLocation(jProp, contextNode);
    let jsonSchema = null;
    if (routePath && method && project && rootPath) {
      const resolved = await resolveValidatorSchema(
        routePath,
        method,
        "json",
        project,
        typeChecker,
        rootPath,
        cacheManager,
        adapter
      );
      if (resolved) {
        jsonSchema = resolved.schema;
        logger.record(method, routePath, "json", resolved.library);
      }
    }
    if (!jsonSchema) {
      jsonSchema = buildSchema({
        type: jType,
        typeChecker,
        contextNode,
        adapter
      });
      if (routePath && method) {
        logger.record(method, routePath, "json", "ts type");
      }
    }
    content["application/json"] = { schema: jsonSchema };
  }
  const fProp = inp.getProperty("form");
  if (fProp) {
    const fType = typeChecker.getTypeOfSymbolAtLocation(fProp, contextNode);
    let formSchema = null;
    if (routePath && method && project && rootPath) {
      const resolved = await resolveValidatorSchema(
        routePath,
        method,
        "form",
        project,
        typeChecker,
        rootPath,
        cacheManager,
        adapter
      );
      if (resolved) {
        formSchema = resolved.schema;
        logger.record(method, routePath, "form", resolved.library);
      }
    }
    if (!formSchema) {
      formSchema = buildSchema({
        type: fType,
        typeChecker,
        contextNode,
        adapter
      });
      if (routePath && method) {
        logger.record(method, routePath, "form", "ts type");
      }
    }
    content["multipart/form-data"] = { schema: formSchema };
  }
  return Object.keys(content).length ? { required: true, content } : null;
}

// src/utils/responseHeaders.ts
import { SyntaxKind as SyntaxKind5 } from "ts-morph";
function extractASTHeaders(routeNode) {
  const headers = [];
  const args = routeNode.getArguments();
  for (const arg of args) {
    const descendants = arg.getDescendantsOfKind(SyntaxKind5.CallExpression);
    for (const callExpr of descendants) {
      const expr = callExpr.getExpression();
      if (expr.isKind(SyntaxKind5.PropertyAccessExpression)) {
        const propAccess = expr;
        if (propAccess.getName() === "header") {
          const callArgs = callExpr.getArguments();
          if (callArgs.length >= 1) {
            const headerNameNode = callArgs[0];
            if (headerNameNode.isKind(SyntaxKind5.StringLiteral)) {
              const headerName = headerNameNode.getLiteralText();
              const headerObj = {
                schema: { type: "string" }
              };
              if (callArgs.length >= 2) {
                const valueNode = callArgs[1];
                if (valueNode.isKind(SyntaxKind5.StringLiteral)) {
                  headerObj.example = valueNode.getLiteralText();
                }
              }
              headers.push({
                name: headerName,
                schema: headerObj
              });
            }
          }
        }
      }
    }
  }
  return headers;
}

// src/openapi/adapters/v3-1.ts
var v31Adapter = {
  version: OPENAPI_VERSIONS.v3_1,
  zodTarget: ZOD_TARGETS.v3_1,
  makeNullable(schema) {
    const s = schema;
    const rest = { ...s };
    delete rest.nullable;
    const existingType = rest.type;
    let newType;
    if (Array.isArray(existingType)) {
      newType = existingType.includes("null") ? existingType : [...existingType, "null"];
    } else if (typeof existingType === "string") {
      newType = [existingType, "null"];
    } else {
      return {
        ...rest,
        anyOf: [rest, { type: "null" }]
      };
    }
    return { ...rest, type: newType };
  },
  makeDocumentRoot(base) {
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      ...base,
      openapi: OPENAPI_VERSIONS.v3_1
    };
  }
};

// src/openapi/adapters/index.ts
function getAdapter(version) {
  if (version == null ? void 0 : version.startsWith("3.1")) return v31Adapter;
  return v30Adapter;
}

// src/core/generateOpenApi.ts
async function generateOpenApi({
  config,
  snapshotPath,
  fileName,
  project,
  rootPath,
  outputRoot,
  cacheManager
}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const sf = project.addSourceFileAtPath(
    path2.resolve(rootPath, snapshotPath.appTypePath)
  );
  sf.refreshFromFileSystemSync();
  const aliasDecl = sf.getTypeAliasOrThrow("AppType");
  const topTypeNode = aliasDecl.getTypeNode();
  let typeArgs;
  if (topTypeNode == null ? void 0 : topTypeNode.isKind(SyntaxKind6.TypeReference)) {
    typeArgs = topTypeNode.getTypeArguments();
  } else if (topTypeNode == null ? void 0 : topTypeNode.isKind(SyntaxKind6.ImportType)) {
    typeArgs = topTypeNode.getTypeArguments();
  } else {
    throw new Error("AppType must be an ImportType or a TypeReference");
  }
  if (typeArgs.length < 2) {
    throw new Error("Expected two type arguments on HonoBase");
  }
  const routesNode = typeArgs[1];
  const paths = {};
  const adapter = getAdapter(config.openApiVersion);
  const fileDependenciesCache = /* @__PURE__ */ new Map();
  const getRouteDepInfo = (filePath) => {
    if (!cacheManager) return { hash: "", files: [] };
    const cached = fileDependenciesCache.get(filePath);
    if (cached) return cached;
    const visited = /* @__PURE__ */ new Set();
    const queue = [filePath];
    while (queue.length > 0) {
      const fp = queue.pop();
      const realFp = fs2.existsSync(fp) ? fs2.realpathSync(fp) : fp;
      if (visited.has(realFp)) continue;
      visited.add(realFp);
      const currSf = project.getSourceFile(realFp) || project.getSourceFile(fp);
      if (!currSf) continue;
      for (const ref of currSf.getReferencedSourceFiles()) {
        const refPath = ref.getFilePath();
        const realRef = fs2.existsSync(refPath) ? fs2.realpathSync(refPath) : refPath;
        if (!realRef.includes("node_modules")) {
          queue.push(realRef);
        }
      }
    }
    const files = Array.from(visited);
    const hash = cacheManager.hashGroup(files);
    const result = { hash, files };
    fileDependenciesCache.set(filePath, result);
    return result;
  };
  const jsDocMap = extractJSDocs(project);
  const typeChecker = project.getTypeChecker();
  const schemaType = typeChecker.getTypeAtLocation(routesNode);
  const types = schemaType.isUnion() ? schemaType.getUnionTypes() : [schemaType];
  for (const t of types) {
    for (const routeProp of t.getProperties()) {
      const raw = routeProp.getName().replace(/"/g, "").replace(/'/g, "");
      const pathPatterns = {};
      const regexExtractor = /:([a-zA-Z0-9_]+)(?:{([^{}]*(?:{[^{}]*}[^{}]*)*)})?/g;
      let match;
      while ((match = regexExtractor.exec(raw)) !== null) {
        if (match[2]) {
          pathPatterns[match[1]] = match[2];
        }
      }
      const route = raw.replace(/:([a-zA-Z0-9_]+)(?:{([^{}]*(?:{[^{}]*}[^{}]*)*)})?/g, "{$1}");
      if (!paths[route]) paths[route] = {};
      const routeType = typeChecker.getTypeOfSymbolAtLocation(
        routeProp,
        aliasDecl
      );
      if (!routeType) continue;
      for (const methodSymbol of routeType.getProperties()) {
        const name = methodSymbol.getName();
        if (!name.startsWith("$")) continue;
        const http = name.slice(1).toLowerCase();
        const routeEntry = locateRouteEntry(http, raw, project);
        const methodType = typeChecker.getTypeOfSymbolAtLocation(
          methodSymbol,
          aliasDecl
        );
        if (!methodType) continue;
        const variants = unwrapUnion(methodType);
        let depHash = "";
        let depFiles = [];
        const routeKey = `${http.toLowerCase()} ${raw}`;
        if (cacheManager) {
          if (routeEntry == null ? void 0 : routeEntry.sourceFilePath) {
            const depInfo = getRouteDepInfo(routeEntry.sourceFilePath);
            depHash = depInfo.hash;
            depFiles = depInfo.files;
            if (depHash) {
              const routeCache = cacheManager.getRouteCache(routeKey, depHash);
              if (routeCache) {
                logger.recordSources(
                  http,
                  raw,
                  routeCache.sources || [],
                  !!(routeCache.operation.summary || routeCache.operation.description || routeCache.operation.tags && routeCache.operation.tags.length > 0)
                );
                paths[route][http] = routeCache.operation;
                continue;
              }
            }
          }
        }
        const exactKey = `${http} ${route}`;
        let jsDoc;
        if (jsDocMap.has(exactKey)) {
          jsDoc = jsDocMap.get(exactKey)[0];
        } else {
          for (const [k, docs] of jsDocMap.entries()) {
            const [mapHttp, ...mapPathParts] = k.split(" ");
            const mapPath = mapPathParts.join(" ");
            if (mapHttp === http && route.endsWith(mapPath)) {
              jsDoc = docs[0];
              break;
            }
          }
        }
        if (jsDoc == null ? void 0 : jsDoc.exclude) {
          continue;
        }
        const hasDoc = !!((jsDoc == null ? void 0 : jsDoc.summary) || (jsDoc == null ? void 0 : jsDoc.description) || (jsDoc == null ? void 0 : jsDoc.tags) && ((_a = jsDoc == null ? void 0 : jsDoc.tags) == null ? void 0 : _a.length) > 0 || (jsDoc == null ? void 0 : jsDoc.deprecated) || (jsDoc == null ? void 0 : jsDoc.examples) && ((_b = jsDoc == null ? void 0 : jsDoc.examples) == null ? void 0 : _b.length) > 0 || (jsDoc == null ? void 0 : jsDoc.responseDescriptions) && Object.keys(jsDoc.responseDescriptions).length > 0 || (jsDoc == null ? void 0 : jsDoc.responseHeaders) && Object.keys(jsDoc.responseHeaders).length > 0);
        logger.registerRoute(http, raw, hasDoc);
        const op = {
          summary: (jsDoc == null ? void 0 : jsDoc.summary) || generateDefaultSummary(http, route),
          responses: {}
        };
        if (jsDoc == null ? void 0 : jsDoc.description) {
          op.description = jsDoc.description;
        }
        if ((jsDoc == null ? void 0 : jsDoc.tags) && jsDoc.tags.length > 0) {
          op.tags = jsDoc.tags;
        }
        if (jsDoc == null ? void 0 : jsDoc.deprecated) {
          op.deprecated = true;
        }
        const params = await genParameters({
          type: variants[0],
          typeChecker,
          contextNode: aliasDecl,
          routePath: raw,
          method: http,
          project,
          rootPath,
          pathPatterns,
          cacheManager,
          adapter
        });
        if (params.length) op.parameters = params;
        const rb = await genRequestBody({
          type: variants[0],
          typeChecker,
          contextNode: aliasDecl,
          routePath: raw,
          method: http,
          project,
          rootPath,
          cacheManager,
          adapter
        });
        if (rb) {
          const bodyExamples = ((_c = jsDoc == null ? void 0 : jsDoc.examples) == null ? void 0 : _c.filter((ex) => !ex.statusCode)) || [];
          if (bodyExamples.length > 0 && rb.content) {
            for (const mediaType of Object.keys(rb.content)) {
              if (bodyExamples.length === 1) {
                rb.content[mediaType].example = bodyExamples[0].value;
              } else {
                const examplesMap = {};
                bodyExamples.forEach((ex, idx) => {
                  examplesMap[`example${idx + 1}`] = { value: ex.value };
                });
                rb.content[mediaType].examples = examplesMap;
              }
            }
          }
          op.requestBody = rb;
        }
        op.responses = {};
        const byStatus = groupBy(variants, (v) => {
          const statusProp = v.getProperty("status");
          if (!statusProp) return "default";
          const statusType = typeChecker.getTypeOfSymbolAtLocation(
            statusProp,
            aliasDecl
          );
          const s = statusType.getText();
          if (statusType.isNumberLiteral()) {
            return String(statusType.getLiteralValue());
          }
          return /^\d+$/.test(s) ? s : "default";
        });
        for (const [code, vs] of Object.entries(byStatus)) {
          const schemas = vs.map((v) => {
            const outProp = v.getProperty("output");
            if (!outProp) return {};
            const outType = typeChecker.getTypeOfSymbolAtLocation(
              outProp,
              aliasDecl
            );
            return buildSchema({
              type: outType,
              typeChecker,
              contextNode: aliasDecl,
              adapter
            });
          });
          const schema = schemas.length > 1 ? { oneOf: schemas } : schemas[0];
          const customDesc = ((_d = jsDoc == null ? void 0 : jsDoc.responseDescriptions) == null ? void 0 : _d[code]) ?? (code !== "default" ? (_e = jsDoc == null ? void 0 : jsDoc.responseDescriptions) == null ? void 0 : _e[code.toLowerCase()] : void 0);
          const defaultDesc = code === "default" ? `Generic status from ${vs[0].getProperty("status").getValueDeclarationOrThrow().getType().getText()}` : `Status ${code}`;
          const responseObj = {
            description: customDesc || defaultDesc,
            content: { "application/json": { schema } }
          };
          const respExamples = ((_f = jsDoc == null ? void 0 : jsDoc.examples) == null ? void 0 : _f.filter((ex) => {
            if (ex.statusCode) {
              return ex.statusCode === code;
            }
            if (!rb && (code === "200" || code === "default" && Object.keys(byStatus).length === 1)) {
              return true;
            }
            return false;
          })) || [];
          if (respExamples.length > 0 && responseObj.content) {
            for (const mediaType of Object.keys(responseObj.content)) {
              if (respExamples.length === 1) {
                responseObj.content[mediaType].example = respExamples[0].value;
              } else {
                const examplesMap = {};
                respExamples.forEach((ex, idx) => {
                  examplesMap[`example${idx + 1}`] = { value: ex.value };
                });
                responseObj.content[mediaType].examples = examplesMap;
              }
            }
          }
          const routeNode = (routeEntry == null ? void 0 : routeEntry.call) ?? null;
          const astHeaders = routeNode ? extractASTHeaders(routeNode) : [];
          const jsdocHeaders = ((_g = jsDoc == null ? void 0 : jsDoc.responseHeaders) == null ? void 0 : _g[code]) || [];
          if (astHeaders.length > 0 || jsdocHeaders.length > 0) {
            responseObj.headers = {};
            for (const h of astHeaders) {
              responseObj.headers[h.name] = h.schema;
            }
            for (const h of jsdocHeaders) {
              responseObj.headers[h.name] = h.schema;
            }
          }
          op.responses[code] = responseObj;
        }
        if (cacheManager && depHash && depFiles.length > 0) {
          const sources = logger.getRouteSources(http, raw);
          cacheManager.setRouteCache(routeKey, depHash, op, sources, depFiles);
        }
        paths[route][http] = op;
      }
    }
  }
  for (const route of Object.keys(paths)) {
    if (Object.keys(paths[route]).length === 0) {
      delete paths[route];
    }
  }
  const spec = {
    ...config.openApi,
    paths
  };
  const outputPath = path2.join(outputRoot, `${fileName}.json`);
  fs2.mkdirSync(path2.dirname(outputPath), { recursive: true });
  fs2.writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");
  return { openApiPath: outputPath };
}

// src/cache/cacheManager.ts
import { createHash } from "crypto";
import {
  existsSync as existsSync2,
  mkdirSync,
  readFileSync as readFileSync2,
  realpathSync,
  writeFileSync as writeFileSync2
} from "fs";
import { join as join2 } from "path";
var EMPTY_MANIFEST = {
  version: "",
  globalHash: "",
  groups: {},
  schemaCache: {},
  routeCache: {}
};
var CacheManager = class {
  constructor(rootPath, pkgVersion) {
    this.dirty = false;
    this.pkgVersion = pkgVersion;
    const cacheDir = join2(rootPath, PROJECT_CACHE_DIR_NAME, "cache");
    mkdirSync(cacheDir, { recursive: true });
    this.manifestPath = join2(cacheDir, "manifest.json");
    this.manifest = this._load();
  }
  // ── File hashing ───────────────────────────────────────────────────────────
  /**
   * Compute a SHA-256 hex digest of a single file's content.
   * Returns an empty string if the file cannot be read (treated as "changed").
   */
  hashFile(filePath) {
    try {
      const content = readFileSync2(filePath, "utf-8");
      return createHash("sha256").update(content).digest("hex");
    } catch {
      return "";
    }
  }
  /**
   * Compute a combined SHA-256 over an ordered list of file paths.
   * Hashes both the paths and their contents so renames are detected.
   */
  hashGroup(filePaths) {
    const h = createHash("sha256");
    const sorted = Array.from(
      new Set(filePaths.map((fp) => existsSync2(fp) ? realpathSync(fp) : fp))
    ).sort();
    for (const fp of sorted) {
      h.update(fp);
      h.update(this.hashFile(fp));
    }
    return h.digest("hex");
  }
  /**
   * Compute a hash of a short string value (e.g. config contents).
   */
  hashString(value) {
    return createHash("sha256").update(value).digest("hex");
  }
  // ── Global invalidation ────────────────────────────────────────────────────
  /**
   * Check whether the global hash (version + config + tsconfig) has changed.
   * If it has, wipe the entire cache before proceeding.
   * Returns true if cache is still valid, false if it was wiped.
   */
  checkGlobal(globalHash) {
    if (this.manifest.version !== this.pkgVersion || this.manifest.globalHash !== globalHash) {
      this.invalidate();
      this.manifest.version = this.pkgVersion;
      this.manifest.globalHash = globalHash;
      this.dirty = true;
      return false;
    }
    return true;
  }
  /**
   * Wipe all cached state. Called on global invalidation or --no-cache flag.
   */
  invalidate() {
    this.manifest = {
      ...EMPTY_MANIFEST,
      version: this.pkgVersion,
      globalHash: this.manifest.globalHash
    };
    this.dirty = true;
  }
  // ── Group-level cache ──────────────────────────────────────────────────────
  /**
   * Returns the cached output path if the group's input hash matches
   * and the cached file still exists on disk. Returns null on cache miss.
   */
  getGroupCache(groupName, groupHash) {
    const entry = this.manifest.groups[groupName];
    if (!entry) return null;
    if (entry.inputHash !== groupHash) return null;
    if (!existsSync2(entry.outputPath)) return null;
    return entry.outputPath;
  }
  /**
   * Returns the full group cache entry if available.
   */
  getGroupEntry(groupName) {
    return this.manifest.groups[groupName] ?? null;
  }
  /**
   * Record a successful group generation in the cache.
   */
  setGroupCache(groupName, groupHash, outputPath, dependencyFiles) {
    this.manifest.groups[groupName] = {
      inputHash: groupHash,
      outputPath,
      dependencyFiles
    };
    this.dirty = true;
  }
  // ── Schema-level cache ─────────────────────────────────────────────────────
  /**
   * Returns a cached OpenAPI schema object if available, or null on cache miss.
   * Key is: sha256(filePath) + exportName + sha256(fileContent)
   */
  getSchemaCache(schemaKey) {
    return this.manifest.schemaCache[schemaKey] ?? null;
  }
  /**
   * Store a resolved schema in the schema cache.
   */
  setSchemaCache(schemaKey, schema) {
    this.manifest.schemaCache[schemaKey] = schema;
    this.dirty = true;
  }
  // ── Route-level fine-grained cache ─────────────────────────────────────────
  /**
   * Returns a cached OpenAPI Operation object for an endpoint if its source file hash matches.
   */
  getRouteCache(routeKey, dependencyHash) {
    var _a;
    const entry = (_a = this.manifest.routeCache) == null ? void 0 : _a[routeKey];
    if (!entry) return null;
    if (entry.dependencyHash !== dependencyHash) return null;
    return entry;
  }
  /**
   * Record a generated OpenAPI Operation object in the fine-grained per-route cache.
   */
  setRouteCache(routeKey, dependencyHash, operation, sources = [], dependencyFiles) {
    if (!this.manifest.routeCache) {
      this.manifest.routeCache = {};
    }
    this.manifest.routeCache[routeKey] = {
      dependencyHash,
      operation,
      sources,
      dependencyFiles
    };
    this.dirty = true;
  }
  // ── Persistence ────────────────────────────────────────────────────────────
  /**
   * Persist the in-memory manifest to disk.
   * Only writes if something actually changed (dirty flag).
   * Non-fatal: a failed flush just means the next run starts cold.
   */
  flush() {
    if (!this.dirty) return;
    try {
      writeFileSync2(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2),
        "utf-8"
      );
    } catch {
    }
  }
  // ── Internal ───────────────────────────────────────────────────────────────
  _load() {
    try {
      if (!existsSync2(this.manifestPath)) return { ...EMPTY_MANIFEST };
      const raw = readFileSync2(this.manifestPath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version ?? "",
        globalHash: parsed.globalHash ?? "",
        groups: parsed.groups ?? {},
        schemaCache: parsed.schemaCache ?? {},
        routeCache: parsed.routeCache ?? {}
      };
    } catch {
      return { ...EMPTY_MANIFEST };
    }
  }
};

// src/utils/deduplicateSchemas.ts
import { createHash as createHash2 } from "crypto";
function getRefPrefix(openapiVersion) {
  if (openapiVersion && openapiVersion.startsWith("2.")) {
    return "#/definitions/";
  }
  return "#/components/schemas/";
}
function hashSchemaStructure(schema) {
  const cleaned = {};
  const sortedKeys = Object.keys(schema).sort();
  for (const k of sortedKeys) {
    if (k === X_SCHEMA_NAME) continue;
    cleaned[k] = schema[k];
  }
  return createHash2("sha256").update(JSON.stringify(cleaned)).digest("hex");
}
function isComponentCandidate(s) {
  if (!s || typeof s !== "object" || s.$ref) return false;
  if (s[X_SCHEMA_NAME] && typeof s[X_SCHEMA_NAME] === "string") return true;
  if (s.properties && typeof s.properties === "object" && Object.keys(s.properties).length > 0) {
    return true;
  }
  if (s.additionalProperties && typeof s.additionalProperties === "object") {
    return true;
  }
  if (s.type === "object" && Object.keys(s).length > 1) {
    return true;
  }
  if (Array.isArray(s.oneOf) && s.oneOf.length > 0) return true;
  if (Array.isArray(s.allOf) && s.allOf.length > 0) return true;
  if (Array.isArray(s.anyOf) && s.anyOf.length > 0) return true;
  return false;
}
function sanitizeComponentName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "").replace(/^[0-9]/, "S$&") || "SharedSchema";
}
function toPascalCase(str) {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((word) => {
    if (/^[A-Z0-9]+$/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join("");
}
function deduplicateComponents(doc) {
  const refPrefix = getRefPrefix(doc.openapi);
  if (!doc.components) doc.components = {};
  if (!doc.components.schemas) doc.components.schemas = {};
  const discovered = /* @__PURE__ */ new Map();
  function migrateLocalDefinitions(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) migrateLocalDefinitions(item);
      return;
    }
    const obj = node;
    for (const defKey of ["$defs", "definitions"]) {
      if (obj[defKey] && typeof obj[defKey] === "object") {
        const defs = obj[defKey];
        for (const [name, schemaObj] of Object.entries(defs)) {
          if (schemaObj && typeof schemaObj === "object") {
            if (!schemaObj[X_SCHEMA_NAME]) schemaObj[X_SCHEMA_NAME] = name;
            migrateLocalDefinitions(schemaObj);
          }
        }
        delete obj[defKey];
      }
    }
    for (const val of Object.values(obj)) {
      migrateLocalDefinitions(val);
    }
  }
  migrateLocalDefinitions(doc.paths);
  function registerCandidate(schema, fallbackName) {
    const hash = hashSchemaStructure(schema);
    let entry = discovered.get(hash);
    if (!entry) {
      entry = {
        hash,
        schema: { ...schema },
        count: 0,
        explicitNames: /* @__PURE__ */ new Set(),
        fallbackNames: /* @__PURE__ */ new Set()
      };
      discovered.set(hash, entry);
    }
    entry.count++;
    if (typeof schema[X_SCHEMA_NAME] === "string") {
      entry.explicitNames.add(schema[X_SCHEMA_NAME]);
    }
    if (fallbackName && fallbackName !== "default") {
      entry.fallbackNames.add(fallbackName);
    }
  }
  function traverseDiscovery(node, fallbackName) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(
        (item, idx) => traverseDiscovery(item, `${fallbackName}_${idx + 1}`)
      );
      return;
    }
    const obj = node;
    if (typeof obj.$ref === "string") {
      if (obj.$ref.startsWith("#/$defs/") || obj.$ref.startsWith("#/definitions/")) {
        const name = obj.$ref.split("/").pop();
        obj.$ref = `${refPrefix}${name}`;
      }
      return;
    }
    if (obj.properties && typeof obj.properties === "object") {
      for (const [propName, propVal] of Object.entries(
        obj.properties
      )) {
        traverseDiscovery(propVal, `${fallbackName}_${propName}`);
      }
    }
    if (obj.items && typeof obj.items === "object") {
      traverseDiscovery(obj.items, `${fallbackName}_Item`);
    }
    if (obj.additionalProperties && typeof obj.additionalProperties === "object") {
      traverseDiscovery(obj.additionalProperties, `${fallbackName}_Value`);
    }
    for (const unionKey of ["oneOf", "allOf", "anyOf"]) {
      if (Array.isArray(obj[unionKey])) {
        obj[unionKey].forEach((item, idx) => {
          traverseDiscovery(item, `${fallbackName}_Variant${idx + 1}`);
        });
      }
    }
    if (obj.content && typeof obj.content === "object") {
      for (const media of Object.values(
        obj.content
      )) {
        if (media && media.schema) {
          traverseDiscovery(media.schema, fallbackName);
        }
      }
    }
    if (obj.schema && typeof obj.schema === "object" && !obj.content) {
      traverseDiscovery(obj.schema, fallbackName);
    }
    if (obj.headers && typeof obj.headers === "object") {
      for (const [hdrName, hdrObj] of Object.entries(
        obj.headers
      )) {
        if (hdrObj && hdrObj.schema) {
          traverseDiscovery(hdrObj.schema, `${fallbackName}_${hdrName}Header`);
        }
      }
    }
    if (isComponentCandidate(obj)) {
      registerCandidate(obj, fallbackName);
    }
  }
  for (const [pathKey, operations] of Object.entries(doc.paths || {})) {
    if (!operations || typeof operations !== "object") continue;
    const cleanPath = pathKey.replace(/[^a-zA-Z0-9]/g, "_");
    for (const [method, operation] of Object.entries(
      operations
    )) {
      if (!operation || typeof operation !== "object") continue;
      const opName = toPascalCase(`${method}_${cleanPath}`);
      if (operation.requestBody && typeof operation.requestBody === "object") {
        traverseDiscovery(operation.requestBody, `${opName}Body`);
      }
      if (operation.responses && typeof operation.responses === "object") {
        for (const [status, resp] of Object.entries(
          operation.responses
        )) {
          traverseDiscovery(resp, `${opName}Response${status}`);
        }
      }
    }
  }
  const existingSchemas = doc.components.schemas;
  const hashToRefMap = /* @__PURE__ */ new Map();
  const candidates = Array.from(discovered.values()).filter((item) => {
    return item.explicitNames.size > 0 || item.count > 1;
  });
  candidates.sort((a, b) => b.count - a.count || a.hash.localeCompare(b.hash));
  for (const cand of candidates) {
    let baseName = "SharedSchema";
    if (cand.explicitNames.size > 0) {
      baseName = Array.from(cand.explicitNames)[0];
      baseName = sanitizeComponentName(baseName);
    } else if (cand.fallbackNames.size > 0) {
      baseName = Array.from(cand.fallbackNames)[0];
      baseName = toPascalCase(baseName);
      baseName = sanitizeComponentName(baseName);
    }
    let finalName = baseName;
    let counter = 2;
    while (existingSchemas[finalName]) {
      const existingHash = hashSchemaStructure(
        existingSchemas[finalName]
      );
      if (existingHash === cand.hash) {
        break;
      }
      finalName = `${baseName}_${counter++}`;
    }
    const cleanSchema = { ...cand.schema };
    delete cleanSchema[X_SCHEMA_NAME];
    existingSchemas[finalName] = cleanSchema;
    cand.assignedRef = `${refPrefix}${finalName}`;
    hashToRefMap.set(cand.hash, cand.assignedRef);
  }
  function rewriteTree(node, inComponents = false) {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) {
      return node.map((item) => rewriteTree(item, inComponents));
    }
    const obj = node;
    if (X_SCHEMA_NAME in obj) {
      delete obj[X_SCHEMA_NAME];
    }
    if (!obj.$ref && isComponentCandidate(obj)) {
      const hash = hashSchemaStructure(obj);
      const assignedRef = hashToRefMap.get(hash);
      if (assignedRef && (!inComponents || obj !== existingSchemas[assignedRef.split("/").pop()])) {
        const rewritten = { ...obj };
        for (const [k, v] of Object.entries(rewritten)) {
          rewritten[k] = rewriteTree(v, inComponents);
        }
        const targetName = assignedRef.split("/").pop();
        if (!inComponents || existingSchemas[targetName] !== obj) {
          return { $ref: assignedRef };
        }
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      obj[k] = rewriteTree(v, inComponents);
    }
    return obj;
  }
  doc.paths = rewriteTree(doc.paths);
  for (const [schemaName, schemaObj] of Object.entries(existingSchemas)) {
    existingSchemas[schemaName] = rewriteTree(
      schemaObj,
      true
    );
  }
  return doc;
}

// src/core/runGenerate.ts
async function runGenerate(configPath, options = {}) {
  var _a;
  const startTime = Date.now();
  const config = await loadConfig(configPath);
  const rootPath = process.cwd();
  const { noCache = false } = options;
  const libDir = getLibDir();
  let pkgVersion = "";
  try {
    const pkgRaw = fs3.readFileSync(path3.join(libDir, "package.json"), "utf-8");
    pkgVersion = JSON.parse(pkgRaw).version ?? "";
  } catch {
  }
  logger.banner(pkgVersion, configPath, config.tsConfigPath);
  logger.analyzing();
  const cache = new CacheManager(rootPath, pkgVersion);
  if (noCache) {
    cache.invalidate();
  } else {
    const configContent = (() => {
      try {
        return fs3.readFileSync(resolve3(rootPath, configPath), "utf-8");
      } catch {
        return "";
      }
    })();
    const tsConfigContent = (() => {
      try {
        return fs3.readFileSync(resolve3(rootPath, config.tsConfigPath), "utf-8");
      } catch {
        return "";
      }
    })();
    const globalHash = cache.hashString(
      pkgVersion + configContent + tsConfigContent
    );
    cache.checkGlobal(globalHash);
  }
  let projectInstance = options.projectInstance || null;
  const getProject = () => {
    if (!projectInstance) {
      projectInstance = new Project3({
        tsConfigFilePath: resolve3(rootPath, config.tsConfigPath)
      });
    }
    return projectInstance;
  };
  const apis = config.apis;
  const snapshotOutputRoot = path3.resolve(
    rootPath,
    PROJECT_CACHE_DIR_NAME,
    "types"
  );
  const openAPiOutputRoot = path3.resolve(
    rootPath,
    PROJECT_CACHE_DIR_NAME,
    "openapi"
  );
  const commonParams = {
    config,
    libDir,
    rootPath
  };
  for (const apiGroup of apis) {
    const normalizedPrefix = apiGroup.apiPrefix === "/" ? "" : apiGroup.apiPrefix;
    const normalizedGroup = { ...apiGroup, apiPrefix: normalizedPrefix };
    const sanitizedName = sanitizeApiPrefix(normalizedPrefix) || "root";
    logger.trackGroup();
    let groupCacheHit = false;
    let groupHash = null;
    let expectedOutput = null;
    let groupDepFiles = [];
    if (!noCache) {
      try {
        const resolvedInput = resolve3(rootPath, apiGroup.appTypePath);
        if (!fs3.existsSync(resolvedInput)) {
          throw new Error("entry file not found, skip hash collection");
        }
        const absInput = fs3.realpathSync(resolvedInput);
        expectedOutput = path3.join(openAPiOutputRoot, `${sanitizedName}.json`);
        const existingGroup = cache.getGroupEntry(sanitizedName);
        if (existingGroup && existingGroup.dependencyFiles && existingGroup.dependencyFiles.includes(absInput)) {
          const quickHash = cache.hashGroup(existingGroup.dependencyFiles);
          const cachedPath = cache.getGroupCache(sanitizedName, quickHash);
          if (cachedPath) {
            groupHash = quickHash;
            groupDepFiles = existingGroup.dependencyFiles;
            logger.cached(sanitizedName);
            groupCacheHit = true;
          }
        }
        if (!groupCacheHit) {
          const depProject = new Project3({
            tsConfigFilePath: resolve3(rootPath, config.tsConfigPath)
          });
          depProject.addSourceFileAtPath(absInput);
          depProject.resolveSourceFileDependencies();
          const visited = /* @__PURE__ */ new Set();
          const queue = [absInput];
          while (queue.length > 0) {
            const fp = queue.pop();
            const realFp = fs3.existsSync(fp) ? fs3.realpathSync(fp) : fp;
            if (visited.has(realFp)) continue;
            visited.add(realFp);
            const sf = depProject.getSourceFile(realFp) || depProject.getSourceFile(fp);
            if (!sf) continue;
            for (const ref of sf.getReferencedSourceFiles()) {
              const refPath = ref.getFilePath();
              const realRef = fs3.existsSync(refPath) ? fs3.realpathSync(refPath) : refPath;
              if (!realRef.includes("node_modules")) {
                queue.push(realRef);
              }
            }
          }
          groupDepFiles = Array.from(visited);
          groupHash = cache.hashGroup(groupDepFiles);
          const cachedPath = cache.getGroupCache(sanitizedName, groupHash);
          if (cachedPath) {
            logger.cached(sanitizedName);
            groupCacheHit = true;
          }
        }
      } catch {
        groupHash = null;
        expectedOutput = null;
        groupDepFiles = [];
      }
    }
    if (!groupCacheHit) {
      const activeProject = getProject();
      const snapshotPath = await generateTypes({
        ...commonParams,
        project: activeProject,
        apiGroup: normalizedGroup,
        fileName: sanitizedName,
        outputRoot: snapshotOutputRoot
      });
      await generateOpenApi({
        snapshotPath,
        apiGroup: normalizedGroup,
        ...commonParams,
        project: activeProject,
        fileName: sanitizedName,
        outputRoot: openAPiOutputRoot,
        // Only pass cacheManager when we have a valid hash to store
        cacheManager: !noCache && groupHash ? cache : void 0
      });
      if (!noCache && groupHash && expectedOutput) {
        cache.setGroupCache(
          sanitizedName,
          groupHash,
          expectedOutput,
          groupDepFiles
        );
      }
    }
  }
  const merged = {
    security: [],
    ...config.openApi,
    tags: [],
    components: { schemas: {} },
    paths: {}
  };
  for (const apiGroup of apis) {
    const normalizedPrefix = apiGroup.apiPrefix === "/" ? "" : apiGroup.apiPrefix;
    const name = sanitizeApiPrefix(normalizedPrefix) || "root";
    const openApiFile = path3.join(openAPiOutputRoot, `${name}.json`);
    if (!fs3.existsSync(openApiFile)) {
      logger.warn(`Missing OpenAPI file: ${openApiFile}`);
      continue;
    }
    const json = JSON.parse(fs3.readFileSync(openApiFile, "utf-8"));
    merged.tags.push({ name: apiGroup.name });
    const customApiMap = /* @__PURE__ */ new Map();
    if (apiGroup == null ? void 0 : apiGroup.api) {
      for (const customApi of apiGroup.api) {
        const fullPath = path3.posix.join(normalizedPrefix, customApi.api).replace(/\/+$/, "").replace(/:([a-zA-Z0-9_]+)(?:{([^{}]*(?:{[^{}]*}[^{}]*)*)})?/g, "{$1}") || "/";
        customApiMap.set(
          `${customApi.method.toLowerCase()} ${fullPath}`,
          customApi
        );
      }
    }
    for (const [pathKey, operations] of Object.entries(
      json.paths
    )) {
      const prefixedPath = path3.posix.join(normalizedPrefix, pathKey).replace(/\/+$/, "") || "/";
      for (const [method, opVal] of Object.entries(operations)) {
        const operation = opVal;
        const opKey = `${method.toLowerCase()} ${prefixedPath}`;
        const customApi = customApiMap.get(opKey);
        const resolvedTag = (_a = config.tagResolver) == null ? void 0 : _a.call(config, prefixedPath);
        if (customApi) {
          operation.summary = customApi.summary || operation.summary;
          operation.description = customApi.description || operation.description;
          operation.tags = customApi.tag && customApi.tag.length > 0 ? customApi.tag : [resolvedTag || apiGroup.name];
        } else if (resolvedTag) {
          operation.tags = [resolvedTag];
        } else {
          operation.tags = operation.tags || [];
          if (!operation.tags.includes(apiGroup.name)) {
            operation.tags.push(apiGroup.name);
          }
        }
        cleanDefaultResponse(operation);
        const finalOperation = config.transformOperation ? config.transformOperation(operation, {
          path: prefixedPath,
          method
        }) : operation;
        if (!finalOperation) continue;
        (merged.paths[prefixedPath] ??= {})[method] = finalOperation;
      }
    }
  }
  for (const [name, meta] of Object.entries(config.tags ?? {})) {
    const existing = merged.tags.find((t) => t.name === name);
    if (existing) Object.assign(existing, meta);
    else merged.tags.push({ name, ...meta });
  }
  const adapter = getAdapter(config.openApiVersion);
  const finalSpec = adapter.makeDocumentRoot(
    merged
  );
  const deduplicatedSpec = deduplicateComponents(
    finalSpec
  );
  const spec = config.transformDocument ? config.transformDocument(deduplicatedSpec) : deduplicatedSpec;
  if (config.validateOutput !== false) {
    try {
      const SwaggerParser = await import("@apidevtools/swagger-parser");
      const clonedSpec = JSON.parse(JSON.stringify(spec));
      await SwaggerParser.default.validate(clonedSpec);
    } catch (err) {
      logger.warn(
        `OpenAPI Spec Validation Warning:
${err.message}`
      );
    }
  }
  let jsonSize;
  let validationFailed = false;
  if (config.outputs.openApiJson) {
    const jsonPath = path3.join(rootPath, config.outputs.openApiJson);
    const specContent = `${JSON.stringify(spec, null, 2)}
`;
    if (options.validate) {
      const existing = fs3.existsSync(jsonPath) ? fs3.readFileSync(jsonPath, "utf-8") : null;
      if (existing !== specContent) {
        logger.error(
          `Validation failed: ${config.outputs.openApiJson} is out of date. Please run 'generate' to update it.`
        );
        validationFailed = true;
      }
    } else {
      fs3.mkdirSync(path3.dirname(jsonPath), { recursive: true });
      fs3.writeFileSync(jsonPath, specContent);
    }
    jsonSize = Buffer.byteLength(specContent, "utf-8");
  }
  let yamlSize;
  if (config.outputs.openApiYaml) {
    const yamlPath = path3.join(rootPath, config.outputs.openApiYaml);
    const yamlContent = yaml.stringify(spec);
    if (options.validate) {
      const existing = fs3.existsSync(yamlPath) ? fs3.readFileSync(yamlPath, "utf-8") : null;
      if (existing !== yamlContent) {
        logger.error(
          `Validation failed: ${config.outputs.openApiYaml} is out of date. Please run 'generate' to update it.`
        );
        validationFailed = true;
      }
    } else {
      fs3.mkdirSync(path3.dirname(yamlPath), { recursive: true });
      fs3.writeFileSync(yamlPath, yamlContent);
    }
    yamlSize = Buffer.byteLength(yamlContent, "utf-8");
  }
  if (!noCache) {
    cache.flush();
  }
  if (options.validate && validationFailed) {
    throw new Error("Validation failed: Output file(s) are out of date.");
  }
  logger.summary();
  if (!options.validate) {
    if (config.outputs.openApiJson) {
      logger.output(config.outputs.openApiJson, jsonSize);
    }
    if (config.outputs.openApiYaml) {
      logger.output(config.outputs.openApiYaml, yamlSize);
    }
  } else {
    logger.success(
      "Validation passed: OpenAPI specifications match the codebase."
    );
  }
  logger.done(Date.now() - startTime);
}

// src/core/runWatch.ts
import fs4 from "fs";
import path4 from "path";
import { Project as Project4 } from "ts-morph";
import chokidar from "chokidar";
import ignore from "ignore";
function watchDirectory(dir, outDirs, internalCacheDir, onChange) {
  const ig = ignore();
  const gitignorePath = path4.join(dir, ".gitignore");
  if (fs4.existsSync(gitignorePath)) {
    try {
      ig.add(fs4.readFileSync(gitignorePath, "utf-8"));
    } catch {
    }
  }
  const watcher = chokidar.watch(dir, {
    ignored: (filePath) => {
      if (filePath.includes("node_modules") || filePath.includes(".git"))
        return true;
      if (outDirs.some((outDir) => filePath.startsWith(outDir))) return true;
      if (filePath.startsWith(internalCacheDir)) return true;
      const relPath = path4.relative(dir, filePath);
      if (relPath && ig.ignores(relPath)) return true;
      return false;
    },
    ignoreInitial: true
  });
  watcher.on("all", (event, filepath) => {
    onChange(filepath);
  });
  return () => watcher.close();
}
async function runWatch(configPath, options = {}) {
  var _a, _b;
  const rootPath = process.cwd();
  const config = await loadConfig(configPath);
  const projectInstance = new Project4({
    tsConfigFilePath: path4.resolve(rootPath, config.tsConfigPath)
  });
  options.projectInstance = projectInstance;
  let isBuilding = false;
  let pendingRun = false;
  let debounceTimeout = null;
  const build = async () => {
    if (isBuilding) {
      pendingRun = true;
      return;
    }
    isBuilding = true;
    pendingRun = false;
    try {
      console.clear();
      logger.info("Changes detected. Rebuilding documentation...");
      await runGenerate(configPath, options);
      logger.success("Waiting for changes... (Press Ctrl+C to exit)");
    } catch (err) {
      logger.error(
        "Build failed:",
        err instanceof Error ? err.message : String(err)
      );
      logger.info("Waiting for changes to recover...");
    } finally {
      isBuilding = false;
      if (pendingRun) {
        build();
      }
    }
  };
  await build();
  const outDirs = [
    ((_a = config.outputs) == null ? void 0 : _a.openApiJson) ? path4.resolve(rootPath, path4.dirname(config.outputs.openApiJson)) : null,
    ((_b = config.outputs) == null ? void 0 : _b.openApiYaml) ? path4.resolve(rootPath, path4.dirname(config.outputs.openApiYaml)) : null
  ].filter(Boolean);
  const internalCacheDir = path4.resolve(rootPath, PROJECT_CACHE_DIR_NAME);
  const handleFileChange = (filepath) => {
    const sourceFile = projectInstance.getSourceFile(filepath);
    if (sourceFile) {
      if (fs4.existsSync(filepath)) {
        sourceFile.refreshFromFileSystemSync();
      } else {
        projectInstance.removeSourceFile(sourceFile);
      }
      invalidateProjectIndex(projectInstance);
    } else if (fs4.existsSync(filepath) && (filepath.endsWith(".ts") || filepath.endsWith(".js"))) {
      projectInstance.addSourceFileAtPath(filepath);
      invalidateProjectIndex(projectInstance);
    }
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(build, 300);
  };
  watchDirectory(rootPath, outDirs, internalCacheDir, handleFileChange);
}
export {
  generateOpenApi,
  generateTypes,
  runGenerate,
  runWatch
};
//# sourceMappingURL=index.js.map