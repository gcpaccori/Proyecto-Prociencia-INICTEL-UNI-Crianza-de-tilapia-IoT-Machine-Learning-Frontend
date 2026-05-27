# INFORME TÉCNICO - PUNTO 1
## Diseño del Contenedor Informático para Aplicaciones de Sistema WEB

**Contrato:** N° PE501091609-2024-PROCIENCIA  
**Proyecto:** Centro de Operación Acuícola - Sistema de Monitoreo de Calidad de Agua y Crianza Masiva de Tilapia  
**Fecha:** Mayo 2026

---

## 1. OBJETIVO

Diseñar e implementar un contenedor informático (Frontend Web) que proporcione una interfaz gráfica moderna y responsive para las aplicaciones de aprendizaje automático basadas en Python, destinado al monitoreo de calidad de agua y dosificación de Floc bacteriano en sistemas acuícolas de crianza masiva.

---

## 2. DESCRIPCIÓN TÉCNICA DEL CONTENEDOR

### 2.1 Stack Tecnológico Principal

- **Framework:** React 19.2.5 con TypeScript
- **Empaquetador:** Vite 8.0.10 (desarrollo y compilación)
- **Lenguaje:** TypeScript (~6.0.2) para tipado estático
- **Estilos:** Tailwind CSS 4.2.4 + componentes shadcn/ui
- **Motor de Renderizado:** React DOM 19.2.5

### 2.2 Arquitectura del Sistema

El contenedor informático implementa una arquitectura modular basada en:

```
Frontend (React/TypeScript/Vite)
    ├── Components (Componentes reutilizables)
    ├── Features (Módulos funcionales)
    ├── Config (Configuración de recursos administrativos)
    └── Services (API Client - Axios)
         └── Backend Python (API REST /api/v1)
```

### 2.3 Características Principales

**Panel de Control (Dashboard):**
- Visualización de métricas en tiempo real de calidad de agua
- Gráficos interactivos usando Recharts 3.8.1
- Tabla de datos dinámica con TanStack React Table 8.21.3

**Gestión Administrativa:**
- CRUD automático de recursos configurables en `src/config/resources.ts`
- Sistema de formularios dinámicos para creación de registros
- Interfaz de búsqueda y filtrado de datos

**Conectividad:**
- Cliente HTTP Axios 1.16.0 para consumo de APIs
- Gestión de estado con TanStack Query 5.100.9 (React Query)
- Proxy configurado en Vite para desarrollo local
- Configuración de Vercel para producción con reescritura de URLs

---

## 3. CARACTERÍSTICAS DE DISEÑO

### 3.1 Diseño Responsivo

- Estilos basados en Tailwind CSS con soporte mobile-first
- Componentes shadcn/ui para interfaz consistente
- Animaciones CSS con tw-animate-css 1.4.0

### 3.2 Accesibilidad

- Componentes de Radix UI 1.4.3 con soporte ARIA
- Navegación clara y estructurada
- Iconografía moderna con Lucide React 1.14.0

### 3.3 Tipado y Seguridad

- TypeScript para detección de errores en tiempo de compilación
- Tipado completo de componentes React
- Validación de tipos en configuración de recursos

---

## 4. INTEGRACIÓN CON BACKEND PYTHON

El contenedor se conecta con un backend basado en Python mediante:

- **Endpoint Base:** `/api/v1` (configurado en `VITE_API_TARGET_URL`)
- **Producción:** `http://37.60.226.53:8000`
- **Desarrollo Local:** Proxy reverso de Vite (`vercel.json` en producción)
- **Protocolo:** REST API (GET, POST, PUT, DELETE)

---

## 5. CONFIGURACIÓN DE DESPLIEGUE

### 5.1 Desarrollo
```bash
npm install
npm run dev
```

### 5.2 Compilación para Producción
```bash
npm run build    # Compila TypeScript + Vite
npm run preview  # Visualiza compilación
```

### 5.3 Variables de Entorno
- `VITE_API_BASE_URL=/api/v1` (ruta del API en frontend)
- `VITE_API_TARGET_URL=http://37.60.226.53:8000` (servidor backend)

### 5.4 Alojamiento
- **Plataforma:** Vercel
- **Configuración:** vercel.json con reescritura de URLs
- **Prevención:** Manejo de rutas protegidas como `/alerts` sin CORS

---

## 6. CONCLUSIONES

El contenedor informático implementado es un Sistema Web moderno, responsive y escalable que:

✓ Proporciona interfaz intuitiva para monitoreo acuícola  
✓ Integra perfectamente con backend Python de aprendizaje automático  
✓ Implementa mejores prácticas de desarrollo web moderno  
✓ Garantiza seguridad y tipado de datos  
✓ Soporta despliegue en producción con Vercel  
✓ Permite extensibilidad mediante sistema de recursos configurables  

El diseño cumple con los requisitos técnicos para aplicaciones de aprendizaje automático en monitoreo de calidad de agua y crianza masiva de tilapia.

---

**Estado:** Completado  
**Conformidad:** Conforme a Contrato N° PE501091609-2024-PROCIENCIA
