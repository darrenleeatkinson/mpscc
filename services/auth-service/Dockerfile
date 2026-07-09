# Multi-stage build — no local Maven required; built on the server.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY services ./services
RUN mvn -q -pl services/auth-service -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/services/auth-service/target/auth-service.jar app.jar
EXPOSE 8081
ENTRYPOINT ["sh","-c","java $JAVA_TOOL_OPTIONS -jar app.jar"]
