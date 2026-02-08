import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sorotzkin Sales API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:5000",
      },
    ],
  },
  apis: ["./api/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
