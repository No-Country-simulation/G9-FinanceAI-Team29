# ---------- Etapa 1: build (Maven + JDK 21) ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cachea dependencias: primero el pom, luego el código.
COPY pom.xml .
RUN mvn -q -B dependency:go-offline

COPY src ./src
RUN mvn -q -B clean package -DskipTests

# ---------- Etapa 2: runtime (solo JRE) ----------
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Copia el fat-jar generado por el spring-boot-maven-plugin.
COPY --from=build /build/target/financeai-backend-0.0.1-SNAPSHOT.jar app.jar

# Render/hosts inyectan $PORT; application.yml lo lee como ${PORT:8081}.
ENV PORT=8081
EXPOSE 8081

# JVM consciente de los límites de memoria del contenedor.
ENTRYPOINT ["sh", "-c", "java -XX:MaxRAMPercentage=75 -jar app.jar"]
