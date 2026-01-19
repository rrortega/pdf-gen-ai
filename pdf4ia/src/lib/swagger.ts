import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PDFGenAI API",
      version: "1.0.0",
      description: "API documentation for PDFGenAI - Alternative to PDF Monkey",
    },
    servers: [
      {
        url: "http://localhost:3030",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "API Key (JWT) generated from the dashboard",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            $id: { type: "string" },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            emailVerification: { type: "boolean" },
          },
        },
        Template: {
          type: "object",
          properties: {
            $id: { type: "string" },
            $createdAt: { type: "string", format: "date-time" },
            $updatedAt: { type: "string", format: "date-time" },
            title: { type: "string" },
            description: { type: "string" },
            html: { type: "string" },
            css: { type: "string" },
            test_data: { type: "object" },
            preview_image: { type: "string" },
            user_id: { type: "string" },
          },
        },
        Document: {
          type: "object",
          properties: {
            $id: { type: "string" },
            $createdAt: { type: "string", format: "date-time" },
            $updatedAt: { type: "string", format: "date-time" },
            template_id: { type: "string" },
            name: { type: "string" },
            data: { type: "object" },
            pdf_file: { type: "string" },
            user_id: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "completed", "failed"],
            },
            error_message: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        TemplateCreateRequest: {
          type: "object",
          required: ["title", "html"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            html: { type: "string" },
            css: { type: "string" },
            test_data: { type: "object" },
          },
        },
        TemplateUpdateRequest: {
          type: "object",
          required: ["title", "html"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            html: { type: "string" },
            css: { type: "string" },
            test_data: { type: "object" },
          },
        },
        DocumentGenerateRequest: {
          type: "object",
          required: ["template_id", "name"],
          properties: {
            template_id: { type: "string" },
            name: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    security: [
      {
        apiKeyAuth: [],
      },
    ],
  },
  apis: ["./src/app/api/v1/templates/*.ts", "./src/app/api/v1/documents/*.ts"], // Path to the API routes
};

const specs = swaggerJsdoc(options);

export default specs;
