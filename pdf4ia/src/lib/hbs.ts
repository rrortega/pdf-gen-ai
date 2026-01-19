import Handlebars from "handlebars";

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
        Handlebars.registerHelper("formatMoney", function (value: number | string, options: any) {
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

    // Comparison helpers
    if (!Handlebars.helpers.eq) {
        Handlebars.registerHelper("eq", (a, b) => a === b);
    }
    if (!Handlebars.helpers.neq) {
        Handlebars.registerHelper("neq", (a, b) => a !== b);
    }
    if (!Handlebars.helpers.gt) {
        Handlebars.registerHelper("gt", (a, b) => a > b);
    }
    if (!Handlebars.helpers.lt) {
        Handlebars.registerHelper("lt", (a: number, b: number) => a < b);
    }

    // Math helpers
    if (!Handlebars.helpers.add) {
        Handlebars.registerHelper("add", (a: number, b: number) => Number(a) + Number(b));
    }
    if (!Handlebars.helpers.sub) {
        Handlebars.registerHelper("sub", (a: number, b: number) => Number(a) - Number(b));
    }

    // String helpers
    if (!Handlebars.helpers.uppercase) {
        Handlebars.registerHelper("uppercase", (str: string) => String(str).toUpperCase());
    }
    if (!Handlebars.helpers.lowercase) {
        Handlebars.registerHelper("lowercase", (str: string) => String(str).toLowerCase());
    }

    // Date/Currency helpers
    if (!Handlebars.helpers.date) {
        Handlebars.registerHelper("date", (date: string | number | Date, format?: string) => {
            const d = new Date(date);
            return typeof format === 'string' ? format : d.toLocaleDateString();
        });
    }

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
