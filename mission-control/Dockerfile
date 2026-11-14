# Build context: mission-control/
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/mission-control .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/mission-control /mission-control
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/mission-control"]
