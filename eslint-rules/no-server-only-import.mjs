/**
 * ESLint rule: no server-only import in a client component.
 *
 * A file that starts with the "use client" directive is bundled for the
 * browser. If it imports a module that touches the database, the storage
 * driver or any other server-side dependency, that dependency is pulled into
 * the browser bundle: the build then fails while tracing Node built-ins
 * (`util/types` from `pg`), or, worse, ships server code to the client.
 *
 * The rule is deliberately narrow: it only fires in files that actually carry
 * the "use client" directive, so server components may import server modules.
 */

const CLIENT_DIRECTIVE = /^\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*\s*["']use client["']/;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing server-only modules from a client component.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          modules: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        "A client component must not import '{{module}}'. Move the shared shape or helper into a dependency-free module and import that instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    if (!CLIENT_DIRECTIVE.test(sourceCode.getText())) {
      return {};
    }

    const options = context.options[0] ?? {};
    const modules = options.modules ?? [];

    /** @param {string} specifier */
    const isRestricted = (specifier) =>
      modules.some((module) => specifier === module || specifier.startsWith(`${module}/`));

    return {
      ImportDeclaration(node) {
        if (!isRestricted(node.source.value)) return;
        context.report({
          node: node.source,
          messageId: "forbidden",
          data: { module: node.source.value },
        });
      },
      ExportNamedDeclaration(node) {
        const declaration = node.source;
        if (!declaration || !isRestricted(declaration.value)) return;
        context.report({
          node: declaration,
          messageId: "forbidden",
          data: { module: declaration.value },
        });
      },
    };
  },
};

export default rule;
