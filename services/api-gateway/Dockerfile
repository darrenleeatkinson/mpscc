FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY services ./services
RUN mvn -q -pl services/api-gateway -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/services/api-gateway/target/api-gateway.jar app.jar
EXPOSE 8080
ENTRYPOINT ["sh","-c","java $JAVA_TOOL_OPTIONS -jar app.jar"]
