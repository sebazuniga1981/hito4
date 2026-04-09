# PsicoConecta - Backend

Backend de **PsicoConecta**, una API REST para registro/login de usuarios y gestion de servicios psicologicos.

## Tecnologias

- Node.js
- Express
- PostgreSQL
- pg
- jsonwebtoken (JWT)
- bcrypt
- cors
- dotenv
- nodemailer
- jest
- supertest
- prueba de acceso admin1


## Funcionalidades

- Registro de usuarios
- Login con JWT
- Ruta protegida de perfil
- CRUD de servicios
- Pruebas basicas de API

## Estructura

- `index.js`: levanta servidor e inicializa base de datos
- `app.js`: rutas y controladores HTTP
- `consultas.js`: conexion y consultas SQL
- `middlewares.js`: middleware de validacion de token
- `secretKey.js`: lectura de clave JWT
- `tests/`: pruebas con Jest + Supertest

## Instalacion

1. Entra a la carpeta `backend`
2. Instala dependencias:

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env` con este formato:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=hito3
JWT_SECRET=tu_clave_jwt
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_clave_smtp_o_app_password
MAIL_FROM="PsicoConecta <tu_correo@gmail.com>"
ADMIN_EMAIL=admin@correo.cl
```

Notas de correo:
- Recomendado: usar `RESEND_API_KEY` (envio por HTTPS, mas estable en Render).
- Si faltan variables SMTP, la API sigue funcionando y solo omite envio de correos.
- Correos automaticos implementados:
1. Al crear reserva (`pendiente`): correo a paciente + correo a admin.
2. Al cambiar estado admin (`confirmada`/`rechazada`/`cancelada`): correo a paciente.

## Ejecucion

Modo desarrollo:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

Tests:

```bash
npm test
```

## Rutas principales

- `POST /api/register`
- `POST /api/login`
- `GET /api/profile`
- `GET /api/servicios`
- `GET /api/servicios/:id`
- `POST /api/servicios`
- `PUT /api/servicios/:id`
- `DELETE /api/servicios/:id`
