import Handlebars from "handlebars";

const MAX_TEMPLATE_HTML_BYTES = 1_048_576;

export class TemplateHtmlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TemplateHtmlError";
    }
}

export function assertHbsTemplateHtml(html: unknown): asserts html is string {
    if (typeof html !== "string") {
        throw new TemplateHtmlError("Template HTML must be a string");
    }
    if (Buffer.byteLength(html) > MAX_TEMPLATE_HTML_BYTES) {
        throw new TemplateHtmlError("Template HTML exceeds 1 MiB");
    }
}

export function registerHbsHelpers() {
    // evita registrar dos veces en hot-reload
    if (Handlebars.helpers["inc"]) return;

    Handlebars.registerHelper("inc", function (value: number | string) {
        const n = Number(value);
        return Number.isFinite(n) ? n + 1 : value;
    });

    // útil también: default
    if (!Handlebars.helpers.default) {
        Handlebars.registerHelper("default", function (value: unknown, fallback: unknown) {
            return value === undefined || value === null || value === "" ? fallback : value;
        });
    }

    // formatMoney: formatea números como dinero
    if (!Handlebars.helpers.formatMoney) {
        Handlebars.registerHelper("formatMoney", function (this: unknown, value: number | string, options: Handlebars.HelperOptions) {
            const num = Number(value);
            if (!Number.isFinite(num)) return value;

            const prefix = options.hash.prefix || "";
            const suffix = options.hash.suffix || "";
            const precision = options.hash.precision !== undefined ? options.hash.precision : 2;
            const thousands = options.hash.thousands || ",";
            const decimal = options.hash.decimal || ".";

            // Formatear con precisión
            const fixed = num.toFixed(precision);
            const parts = fixed.split(".");

            // Agregar separador de miles
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);

            // Unir con separador decimal
            const formatted = parts.join(decimal);

            return prefix + formatted + suffix;
        });
    }

    // formatNumber: formatea números sin prefijos
    if (!Handlebars.helpers.formatNumber) {
        Handlebars.registerHelper("formatNumber", function (this: unknown, value: number | string, options: Handlebars.HelperOptions) {
            const num = Number(value);
            if (!Number.isFinite(num)) return value;

            const precision = options.hash.precision !== undefined ? options.hash.precision : 2;
            const thousands = options.hash.thousands || ",";
            const decimal = options.hash.decimal || ".";

            const fixed = num.toFixed(precision);
            const parts = fixed.split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
            return parts.join(decimal);
        });
    }

    // formatPercent: formatea como porcentaje (multiplica por 100)
    if (!Handlebars.helpers.formatPercent) {
        Handlebars.registerHelper("formatPercent", function (this: unknown, value: number | string, options: Handlebars.HelperOptions) {
            const num = Number(value);
            if (!Number.isFinite(num)) return value;

            const precision = options.hash.precision !== undefined ? options.hash.precision : 0;
            return (num * 100).toFixed(precision) + "%";
        });
    }

    // Comparison helpers
    // Comparison helpers
    if (!Handlebars.helpers.isEven) {
        Handlebars.registerHelper("isEven", (value: unknown) => {
            const num = Number(value);
            return !isNaN(num) && num % 2 === 0;
        });
    }

    if (!Handlebars.helpers.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
    }
    if (!Handlebars.helpers.neq) {
        Handlebars.registerHelper("neq", (a, b) => a !== b);
    }
    if (!Handlebars.helpers.notEq) {
        Handlebars.registerHelper("notEq", (a, b) => a !== b);
    }
    if (!Handlebars.helpers.gt) {
        Handlebars.registerHelper("gt", (a, b) => a > b);
    }
    if (!Handlebars.helpers.lt) {
        Handlebars.registerHelper("lt", (a: number, b: number) => a < b);
    }
    if (!Handlebars.helpers.gte) {
        Handlebars.registerHelper("gte", (a: number, b: number) => a >= b);
    }
    if (!Handlebars.helpers.lte) {
        Handlebars.registerHelper("lte", (a: number, b: number) => a <= b);
    }

    // Logical helpers
    if (!Handlebars.helpers.and) {
        Handlebars.registerHelper("and", (...args: unknown[]) => {
            // Remove the options object (last argument in Handlebars helpers)
            const values = args.slice(0, -1);
            return values.every(Boolean);
        });
    }

    if (!Handlebars.helpers.or) {
        Handlebars.registerHelper("or", (...args: unknown[]) => {
            const values = args.slice(0, -1);
            return values.some(Boolean);
        });
    }

    if (!Handlebars.helpers.not) {
        Handlebars.registerHelper("not", (value: unknown) => !value);
    }

    // Math helpers
    if (!Handlebars.helpers.add) {
        Handlebars.registerHelper("add", (a: number, b: number) => Number(a) + Number(b));
    }
    if (!Handlebars.helpers.sub) {
        Handlebars.registerHelper("sub", (a: number, b: number) => Number(a) - Number(b));
    }

    // Assignment helper (to emulate liquid {% assign %})
    if (!Handlebars.helpers.assign) {
        const assignHelper = function (this: Record<string, unknown>, name: string, value: unknown, options: Handlebars.HelperOptions) {
            // Handle block usage: {{#assign "name"}}value{{/assign}}
            if (!value && options && options.fn) {
                value = options.fn(this);
            }

            // Set the value in the current context
            this[name] = value;

            // Return nothing
            return "";
        };
        Handlebars.registerHelper("assign", assignHelper);
        Handlebars.registerHelper("set", assignHelper);
    }

    // Math helper: {{math a "+" b}}
    if (!Handlebars.helpers.math) {
        Handlebars.registerHelper("math", (lvalue: unknown, operator: string, rvalue: unknown) => {
            const l = Number(lvalue);
            const r = Number(rvalue);

            if (isNaN(l) || isNaN(r)) return 0;

            switch (operator) {
                case "+": return l + r;
                case "-": return l - r;
                case "*": return l * r;
                case "/": return l / r;
                case "%": return l % r;
                default: return 0;
            }
        });
    }

    // String helpers
    if (!Handlebars.helpers.uppercase) {
        Handlebars.registerHelper("uppercase", (str: string) => String(str).toUpperCase());
    }
    if (!Handlebars.helpers.upcase) {
        Handlebars.registerHelper("upcase", (str: string) => String(str).toUpperCase());
    }
    if (!Handlebars.helpers.lowercase) {
        Handlebars.registerHelper("lowercase", (str: string) => String(str).toLowerCase());
    }
    if (!Handlebars.helpers.strip) {
        Handlebars.registerHelper("strip", (str: string) => typeof str === 'string' ? str.trim() : str);
    }
    if (!Handlebars.helpers.newline_to_br) {
        Handlebars.registerHelper("newline_to_br", (str: string) => {
            if (typeof str !== 'string') return str;
            const escaped = Handlebars.Utils.escapeExpression(str);
            return new Handlebars.SafeString(escaped.replace(/\r?\n|&#10;/g, '<br />'));
        });
    }

    // Date/Currency helpers
    // Updated date helper with liquid-style format support
    Handlebars.registerHelper("date", (date: string | number | Date, format?: string) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;

        if (typeof format !== 'string') {
            return d.toLocaleDateString();
        }

        const map: Record<string, string> = {
            '%m': String(d.getMonth() + 1).padStart(2, '0'),
            '%d': String(d.getDate()).padStart(2, '0'),
            '%Y': String(d.getFullYear()),
            '%H': String(d.getHours()).padStart(2, '0'),
            '%M': String(d.getMinutes()).padStart(2, '0'),
            '%S': String(d.getSeconds()).padStart(2, '0'),
            '%y': String(d.getFullYear()).slice(-2),
        };

        return format.replace(/%[mYdHMSy]/g, (match) => map[match] || match);
    });

    if (!Handlebars.helpers.currency) {
        Handlebars.registerHelper("currency", (amount: number, currency: string = "USD") => {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency,
            }).format(amount);
        });
    }
}

export function registerHbsPartials() {
    // Registrar partials comunes

    // Partial para formatear dinero (alternativa al helper)
    if (!Handlebars.partials["money-format"]) {
        Handlebars.registerPartial("money-format", "{{formatMoney this prefix=\"$\" precision=2}}");
    }
}

/** Compile only validated template strings while preserving the existing helpers. */
export function renderHbsHtml(html: unknown, data: unknown): string {
    assertHbsTemplateHtml(html);
    registerHbsHelpers();
    registerHbsPartials();
    return Handlebars.compile(html)(data);
}
