# Docker Deployment

## 1. Build the image

```bash
docker build -t datastoria -f docker/Dockerfile .
```

## 2. Run the container

**Basic:**

```bash
docker run --name datastoria -p 3000:3000 datastoria
```

**With environment file:**

```bash
docker run --name datastoria -p 3000:3000 --env-file .env datastoria
```

## 3. Access the application

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env` file in the project root. See `.env.example` for available options.
