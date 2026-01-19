# PDFGenAI - Alternative to PDF Monkey

Una plataforma para crear y gestionar plantillas de PDF con generación automática usando Appwrite.

## 🚀 Características

- **Autenticación completa** con Appwrite
- **Gestión de plantillas** con Handlebars templating
- **Generación de PDFs** usando Puppeteer
- **Almacenamiento** en Appwrite Storage
- **Modo dual**: Síncrono (local) / Asíncrono (producción)
- **Dashboard web** completo

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de datos**: Appwrite Database
- **Storage**: Appwrite Storage
- **Auth**: Appwrite Authentication
- **PDF Generation**: Puppeteer + Handlebars

## 📦 Instalación

1. **Clona el repositorio**

   ```bash
   git clone <repo-url>
   cd pdf4ia
   npm install
   ```

2. **Configura variables de entorno** en `.env.local`:

   ```bash
   NEXT_PUBLIC_APPWRITE_PROJECT_ID=6967f2f7001ae2212a9b
   NEXT_PUBLIC_APPWRITE_PROJECT_NAME=PDFGenAI
   NEXT_PUBLIC_APPWRITE_ENDPOINT=https://aw.chamba.pro/v1
   NEXT_PUBLIC_APPWRITE_DATABASE_ID=6968108e00298587f520
   APPWRITE_API_KEY=standard_26c82b29266f1de3aa69c8c660dcaf3b734029eb4316a4de3614d9f53696676829fc339cbc44407b3f13f5dd4469905ee81db59847d7c73539bb9ad5b1060e162897674a7e5f34bb52919a0c07a9d82e7fdb11f5a03e63099ab289d5b1480a158e420d8a778d723009e441875489e73e42e410c56b5664ea35fd5c8ab502633e
   PDF_GENERATION_MODE=sync
   ```

3. **Configura la base de datos**

   ```bash
   npm run dev
   # La aplicación estará en: http://localhost:3030
   # Luego ejecuta el script de setup:
   node test-setup.js
   ```

### 4. Diagnóstico del sistema

Para verificar que todo esté funcionando correctamente:

**Test básico de conectividad:**

```
http://localhost:3030/api/health
```

**Estado de la base de datos:**

```
http://localhost:3030/api/db-status
```

**Test completo del sistema:**

```
http://localhost:3030/api/internal-test
```

Este endpoint verificará:

- ✅ Variables de entorno cargadas
- ✅ Conexión con Appwrite
- ✅ Estado de autenticación

**Documentación de la API:**

```
http://localhost:3030/api/docs
```

http://localhost:3030/api/health

```

**Test completo del sistema:**

```

http://localhost:3030/api/internal-test

```

Este endpoint verificará:

- ✅ Variables de entorno cargadas
- ✅ Conexión con Appwrite
- ✅ Estado de autenticación

**Documentación de la API:**

```

http://localhost:3030/api/docs

```

**Estado de la base de datos:**

```

http://localhost:3030/api/db-status

```

http://localhost:3030/api/docs

```

### 5. Probar desde el navegador

1. Abre: `http://localhost:3030`
2. Verifica que la página carga correctamente
3. Regístrate con un email y password
4. El sistema debería mantener la sesión automáticamente

### 5. Solución de problemas

#### Error `User (role: guests) missing scopes ([\"account\"])`:

Este error ocurre cuando intentas acceder a endpoints protegidos sin una sesión válida.

**Soluciones:**

1. **Asegúrate de hacer login primero:**

   ```bash
   curl -X POST http://localhost:3030/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"tu@email.com","password":"tu_password"}' \
     -c cookies.txt
   ```

````

2. **Usa las cookies en requests posteriores:**

   ```bash
   curl -X GET http://localhost:3030/api/v1/auth/me \
     -b cookies.txt
   ```

3. **Desde el navegador:**
   - Abre `http://localhost:3030`
   - Regístrate o haz login
   - Las cookies se manejan automáticamente

4. **Verifica la configuración de Appwrite:**
   - Asegúrate de que el proyecto existe en `https://aw.chamba.pro`
   - Verifica que el `APPWRITE_API_KEY` tenga permisos suficientes
   - Confirma que el `DATABASE_ID` sea correcto

#### Test de conexión básica:

```bash
curl http://localhost:3030/api/test
# Debería devolver información sobre la conexión con Appwrite
```

#### Si el servidor no responde:

- Verifica que esté corriendo: `npm run dev`
- Confirma el puerto: `http://localhost:3030`
- Revisa los logs de la consola por errores

Si el servidor no responde:

- Verifica que esté corriendo en el puerto 3030
- Revisa los logs del servidor en la consola
- Asegúrate de que no haya otro proceso usando el puerto

O configura manualmente con:

```bash
curl -X POST http://localhost:3030/api/v1/setup
```

## 🚀 Despliegue

### Variables de producción

```bash
PDF_GENERATION_MODE=async
PDF_REDIS_URL=redis://your-redis-url
```

### Consideraciones

- Configurar timeouts apropiados
- Monitorear uso de memoria (Puppeteer)
- Implementar rate limiting
- Configurar logs adecuados

## 📝 Roadmap

- [ ] Dashboard completo con gestión de plantillas
- [ ] Editor visual de plantillas
- [ ] Preview de PDFs
- [ ] API keys para integración externa
- [ ] Webhooks para notificaciones
- [ ] Plantillas predefinidas
- [ ] Analytics y métricas

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
````
