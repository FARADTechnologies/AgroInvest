# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S ektis && adduser -S ektis -G ektis
COPY --from=build /src/target/ektis-mock.jar /app/ektis-mock.jar
USER ektis
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=50", "-jar", "/app/ektis-mock.jar"]
