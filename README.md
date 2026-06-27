# 🪐 Cinturón de Asteroides · Simulador

Dashboard y **simulador 3D interactivo** del cinturón de asteroides. Toma los
**datos orbitales reales** de la *JPL Small-Body Database* (más de un millón de
cuerpos) y los convierte en una experiencia visual, navegable y educativa,
construida con **Next.js 16 (App Router + Cache Components/PPR)**, **React 19**,
**Tailwind CSS v4**, **Three.js** y **PostgreSQL**.

## ¿De qué trata?

Es una herramienta para **explorar y entender el cinturón de asteroides** sin ser
experto. Combina dos vistas que comparten los mismos filtros:

1. Un **mapa orbital 3D en tiempo real** donde los asteroides se propagan con
   mecánica kepleriana, orbitando el Sol junto a la Tierra, Marte y Júpiter.
2. Un **catálogo navegable** (tabla virtualizada + buscador + KPIs) sobre el
   millón de registros, con paginación por cursor y caché por filtros.

Está pensado para **divulgación y exposiciones de astronomía**: el mapa es la
pieza central, con un estilo cuidado (resplandor del Sol, rocas irregulares,
telaraña de órbitas) y controles que cualquier visitante puede usar.

## ¿Qué hace?

- 🌌 **Visualiza el cinturón en 3D**: arrastra para rotar, rueda para hacer zoom,
  pantalla completa, y observa cómo los cuerpos avanzan en su órbita con una
  **línea de tiempo** de velocidad ajustable (±10 años).
- 🎯 **Selecciona cualquier asteroide** con un clic: dibuja su **órbita completa**,
  lo resalta como una **roca 3D giratoria** con un retículo, y muestra una ficha
  con sus datos clave (con acceso a la ficha completa).
- 🪐 **Muestra el sistema a escala**: Sol resplandeciente, Tierra, Marte y Júpiter
  recorriendo sus órbitas reales, todo etiquetado.
- 🕸️ **"Ver todas las órbitas"**: dibuja la elipse de cada asteroide de la muestra.
- 🔢 **Elige cuántos cuerpos ver** (presets de 500 a 5 000 o una cantidad
  personalizada) y consulta en una tarjeta **cuántos se muestran de cuántos hay**.
- 🔎 **Filtra y busca** por tamaño, reflectividad (albedo), distancia al Sol, tipo
  de órbita, NEO y peligrosidad (PHA), con buscador y autocompletado. Todo el
  estado vive en la URL → **vistas compartibles**.
- 📊 **Resume el conjunto** con KPIs vivos (conteos, masa estimada, riesgo) y una
  **tabla con scroll infinito** sobre el catálogo completo.

---

## ✨ Características

| Requisito | Implementación |
|-----------|----------------|
| Paginación estricta en servidor | Cursor **keyset** sobre `id` (y orden compuesto `(valor, id)` para otras columnas), nunca `OFFSET` |
| Lotes de 50–100 registros | Route Handler `/api/asteroids` (60 por página) + RSC para la carga inicial |
| Carga inicial RSC + streaming | `page.tsx` (RSC) + `Suspense` + `loading.tsx` |
| Payload mínimo (< 15 KB por página) | Proyección ligera (`AsteroidSummary`, 16 campos) — las columnas pesadas solo en el detalle |
| Caché de consultas frecuentes | `use cache` + `cacheLife('hours')` + `cacheTag('asteroids')` por combinación de filtros |
| Virtualización obligatoria | `@tanstack/react-virtual` (solo renderiza las filas visibles) |
| Filtros con *debounce* 300 ms | Tamaño, albedo, distancia (a), tipo de órbita, NEO/PHA, búsqueda |
| Estado en la URL | Todo filtro vive en `searchParams` → vistas compartibles |
| Mapa orbital 3D | **Three.js** + `OrbitControls` + **UnrealBloom**, cargado con `next/dynamic { ssr: false }` |
| KPIs vivos | Conteo animado, color verde→rojo según umbral de riesgo, *glassmorphism* |
| Sliders duales de rango | Tamaño (km), albedo y distancia al Sol (UA) — con explicaciones (ⓘ) |
| Buscador con autocompletado | `/api/asteroids/search` predictivo |
| Línea de tiempo de simulación | Propagación kepleriana en el cliente, velocidad variable, contador de encuentros |
| Filtros amigables | Clases con nombres legibles (Apolo, Cinturón principal…) y términos técnicos explicados |
| Tema oscuro espacial | Gradientes slate→zinc, *backdrop-blur*, fondo estelar animado + partículas |

---

## 🔭 Mapa orbital 3D — la pieza central

El simulador ([`ui/components/orbital-map/`](src/features/asteroids/ui/components/orbital-map/))
es un escenario imperativo de Three.js cargado solo en el cliente:

- **Asteroides como rocas irregulares**, no puntos redondos, coloreados por
  familia: cinturón (azul), NEO/otros (cian), PHA (rojo). Tamaño de punto
  **adaptativo** según la cantidad mostrada.
- **Sol resplandeciente** con halos y **bloom** (`UnrealBloomPass`), más **Tierra,
  Marte y Júpiter** orbitando sobre sus elipses reales, con etiquetas.
- **Selección por clic** (raycasting): dibuja la **órbita completa** del cuerpo, lo
  marca con una **roca 3D facetada** que rota y un retículo pulsante, y abre una
  tarjeta con `a`, `e`, `i`, diámetro y un botón **"Ver ficha completa"**.
- **Tooltip** con el nombre al pasar el cursor; distingue arrastre (rotar) de clic.
- **"Ver todas las órbitas"**: telaraña con la elipse de cada cuerpo de la muestra.
- **Selector de cantidad**: presets (500 / 1 500 / 3 000 / 5 000) o un valor
  **personalizado**, y una tarjeta que indica **cuántos se muestran de cuántos hay**.
- **Línea de tiempo**: reproducir/pausar, velocidad (10× / 30× / 90× / 200×),
  desplazamiento manual y **contador de encuentros** cercanos a la Tierra.
- **Pantalla completa** para proyección/exposición.

---

## 🏛️ Arquitectura — Hexagonal por *feature*

El código de cada *feature* vive en `src/features/<feature>/` y se organiza en
las capas de la **arquitectura hexagonal (puertos y adaptadores)**:

```
src/
├─ app/                              # Capa de routing (delgada)
│  ├─ page.tsx · loading.tsx · error.tsx · layout.tsx · globals.css
│  └─ api/asteroids/                 # Route Handlers (adaptador HTTP de entrada)
│     ├─ route.ts                    # GET listado (cursor)
│     ├─ search/route.ts             # GET autocompletado
│     ├─ orbits/route.ts             # GET muestra de elementos orbitales (3D) + total
│     └─ [id]/route.ts               # GET detalle
│
├─ features/asteroids/
│  ├─ domain/                        # ⬡ NÚCLEO — sin React, sin SQL, sin Next
│  │  ├─ asteroid.ts                 #   entidades / proyecciones
│  │  ├─ filters.ts                  #   value object + parse/serialize de la URL
│  │  ├─ physics.ts                  #   funciones puras (Kepler, masa, velocidad, riesgo)
│  │  └─ ports.ts                    #   AsteroidRepository (puerto)
│  ├─ application/                   # Casos de uso (orquestan dominio + puertos)
│  │  ├─ dashboard-stats.ts · asteroid-queries.ts · http.ts
│  ├─ infrastructure/                # Adaptadores (implementan los puertos)
│  │  ├─ db.ts                       #   pool pg perezoso
│  │  ├─ postgres-asteroid-repository.ts
│  │  ├─ sql.ts · cursor.ts · row-mapper.ts
│  │  └─ index.ts                    #   composition root (bind puerto→adaptador)
│  └─ ui/                            # Adaptador de presentación (React)
│     ├─ components/  hooks/  server/  risk.ts
│
└─ shared/                           # Utilidades transversales (formato, hooks, starfield)
```

**Regla de dependencias:** `domain` no importa nada de fuera; `application`
depende solo de `domain` (y sus puertos); `infrastructure` implementa los
puertos; `ui` consume casos de uso. La página/route handlers son el *composition
root* que inyecta el `PostgresAsteroidRepository`. Cambiar de base de datos =
escribir un nuevo adaptador, sin tocar dominio, casos de uso ni UI.

---

## 🔌 Requisitos previos

- **Node.js ≥ 20.9** (probado con Node 22 y 24).
- **PostgreSQL** accesible con la tabla `public.asteroides` y sus índices ya
  creados (`id` PK, `a`, `albedo`, `class`, `diameter`, `e`, `h`, `i`, `name`,
  `full_name`).
- Opcional: **Docker** para empaquetar y desplegar (ver más abajo).

---

## ⚙️ Configuración

Las credenciales se leen de variables de entorno. Copia el ejemplo y edítalo:

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|----------|-------------|
| `DB_HOST` | Host de PostgreSQL (p. ej. `192.168.1.12` o `localhost`) |
| `DB_PORT` | Puerto (por defecto `5432`) |
| `DB_USER` | Usuario de la base de datos |
| `DB_PASSWORD` | Contraseña |
| `DB_NAME` | Nombre de la base de datos (p. ej. `db_meteor`) |
| `DB_SSL` | `true` si el servidor exige TLS |
| `DB_POOL_MAX` | Tamaño máximo del *pool* de conexiones (por defecto `10`) |
| `DATABASE_URL` | Alternativa: `postgres://user:pass@host:5432/db` (tiene prioridad) |

> ⚠️ Ajusta `DB_USER`, `DB_PASSWORD` y `DB_NAME` a tu servidor real antes de
> arrancar. El pool se crea de forma **perezosa** (en la primera consulta), así
> que compilar la app **no** requiere una base de datos accesible.

---

## 🚀 Instalación y ejecución

```bash
npm install
npm run dev        # desarrollo → http://localhost:3000
# producción
npm run build
npm run start
```

Otros scripts: `npm run lint` (ESLint).

---

## 🐳 Docker

La app se empaqueta con una imagen multi-etapa que ejecuta el **servidor
standalone** de Next (`output: "standalone"`), liviana y sin dependencias extra.
Los secretos **no** se hornean en la imagen: se pasan en tiempo de ejecución.

```bash
# Construir
docker build -t asteroides .

# Ejecutar (la config de BD se inyecta al arrancar)
docker run --env-file .env -p 3000:3000 asteroides
```

Queda servido en `http://localhost:3000`.

> 🛜 **Red hacia la BD:** si PostgreSQL corre en el **mismo equipo** que Docker,
> dentro del contenedor `localhost` no es el host — usa `host.docker.internal`
> (Docker Desktop) o `--network host` (Linux), o apunta `DB_HOST` a la IP de red.

---

## 🌐 API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/asteroids?…&cursor=&limit=` | Listado paginado por cursor (keyset) |
| GET | `/api/asteroids/search?q=&limit=` | Autocompletado por nombre/designación |
| GET | `/api/asteroids/orbits?…&limit=` | Muestra de elementos orbitales para el mapa 3D (devuelve `orbits` + `total` disponible) |
| GET | `/api/asteroids/:id` | Detalle completo de un cuerpo |

Todos aceptan los mismos parámetros de filtro que la UI (`dia_min`, `dia_max`,
`alb_min/max`, `a_min/max`, `cls`, `neo`, `pha`, `q`, `sort`, `dir`).

---

## 🧭 Decisiones técnicas

- **Cache Components / PPR** (`cacheComponents: true`): se sirve un *shell*
  estático al instante (cabecera + esqueletos) y las secciones dependientes de
  datos hacen *streaming* en tiempo de petición. La ruta `/` se compila como
  **◐ Partial Prerender**.
- **Paginación keyset** en lugar de `OFFSET`: rendimiento O(log n) en páginas
  profundas aprovechando los índices existentes. El cursor codifica el valor de
  orden y el `id` (desempate) en base64.
- **`@tanstack/react-virtual`**: *headless*, mínima y compatible con React 19, se
  integra de forma natural con el *scroll* infinito por cursor.
- **Caché por filtros**: como el catálogo es prácticamente estático, cada
  combinación de filtros se cachea unas horas (`cacheTag('asteroids')` permite
  invalidar todo de golpe si se recargan los datos).
- **`pg` perezoso y `server-only`**: el pool se crea en la primera consulta
  (nunca en *build*); los módulos de datos están marcados `server-only` y `pg`
  se mantiene externo al *bundle* (`serverExternalPackages`).
- **Three.js** cargado con `next/dynamic { ssr: false }` para no tocar `window`
  en el servidor; el mapa se actualiza de forma **imperativa** (un único bucle de
  animación con refs) para no re-renderizar React en cada cuadro.
- La columna **`class`** (clase orbital: MBA, OMB, NEO…) se usa como "tipo"
  (el dataset no incluye tipo espectral).

## 🔬 Sobre la simulación (aproximaciones)

Las magnitudes derivadas son **estimaciones físicas con fines educativos**, no de
grado efeméride:

- **Masa:** esfera de densidad ρ ≈ 2 g/cm³ → `m = ρ·(4/3)π r³`.
- **Velocidad orbital:** vis-viva en `r = a` → `v ≈ 29,78 / √a` km/s.
- **Posición:** elementos keplerianos propagados resolviendo la ecuación de
  Kepler (Newton–Raphson) y transformando del plano perifocal al eclíptico.
- **Encuentros cercanos:** distancia simulada cuerpo–Tierra < 0,05 UA sobre la
  muestra mostrada (los cuerpos del cinturón rara vez se acercan; filtra por NEO
  para ver el contador animarse).
- **Índice de riesgo:** combinación heurística de PHA/NEO, MOID y tamaño.

