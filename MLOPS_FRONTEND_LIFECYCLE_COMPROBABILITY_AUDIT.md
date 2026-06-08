# Auditoria de comprobabilidad del ciclo MLOps en frontend

Proyecto: AquaTwin Studio, INICTEL-UNI PROCIENCIA.

Objetivo: que un productor tecnico o investigador pueda operar el ciclo de vida completo de modelos ML sin saber de backend, y que siempre pueda comprobar que cada paso usa datos reales, guarda evidencia y deja trazabilidad.

Fecha de verificacion: 2026-06-08.

Backend consumido por frontend:

- Base API publica: `https://proyecto-prociencia-inictel-uni-cri-seven.vercel.app/api/v1`
- Estado comprobado: `GET /health` responde online en produccion.
- Dashboard comprobado: `GET /frontend/dashboard` devuelve granja, estanque, telemetria, 40 componentes integrables, 13 runners/modelos ejecutables, evidencias y trazabilidad.

## Diagnostico ejecutivo

El backend ya expone un ciclo MLOps real: datos, limpieza, feature sets, entrenamiento, artefactos, activacion, inferencia y trazabilidad. El frontend ya consume muchas de esas rutas, pero la experiencia todavia se siente dispersa: el usuario ve datos, modelos y trazabilidad, pero no siempre entiende que paso ya ocurrio, que formula o metodo se uso, donde se guardo, que debe hacer despues y si el modelo es confiable para produccion.

El objetivo visual no debe ser "mostrar muchas tarjetas". Debe ser "guiar el ciclo de vida": Datos reales -> Limpieza -> Features -> Entrenamiento -> Validacion -> Artefacto -> Produccion -> Inferencia -> Evidencia.

Actualizacion de cierre: el modulo `Modelos ML` queda como centro operativo del ciclo. Incluye estado del modelo champion, catalogo de candidatos, autorrelleno de pruebas, grafica observado vs predicho, grafica de error, influencia de variables, pipeline clicable, inferencia guiada, historial de inferencias guardadas y evidencia tecnica del ciclo backend.

## Evidencia real comprobada

| Punto | Ruta comprobada | Evidencia |
|---|---|---|
| Backend online | `GET /health` | Servicio online en ambiente `production`. |
| Dashboard real | `GET /frontend/dashboard` | 1 granja, 1 estanque, 4 sensores, 3 actuadores, 5000 mediciones limpias cargadas. |
| Componentes del proyecto | `GET /frontend/dashboard` | 45 componentes totales, 40 integrables, 5 condicionados, 13 runners ejecutables. |
| Variables reales | `GET /datasets/variables?pond_id=LEGACY-POND-1` | `dissolved_oxygen_mg_l`, `nitrate_ion`, `ph`, `water_temperature_c`; 16268 registros por variable; completitud 1.0. |
| Modelo entrenable | `GET /datasets/readiness?pond_id=LEGACY-POND-1&model_code=ML_NONLINEAR_SVM` | `can_train: true`; no faltan variables; minimo requerido 8 registros. |
| Limpieza real | `GET /data/cleaning-runs` | 2 corridas completadas; 63256 registros procesados; 1637 outliers detectados. |
| Detalle limpieza | `GET /data/cleaning-runs/{run_id}/summary` | Pasos: carga raw, interpolacion, regla 3 sigma, MinMax, persistencia de mediciones limpias. |
| Features reales | `GET /features` | 2 feature sets; 15813 filas; split train 11069, validacion 2371, test 2373. |
| Columnas y Pearson | `GET /features/{feature_set_id}/columns` | Variables con score Pearson contra target. |
| Entrenamientos | `GET /ml/training-jobs` | 10 jobs; 9 completados, 1 fallido con error tecnico explicado. |
| Artefactos | `GET /ml/model-assets?status=active&include_payload=false` | 8 artefactos activos versionados. |
| Inferencia ML | `POST /models/{model_code}/predict` | Usado por frontend para probar modelo activo. |
| Trazabilidad | `GET /frontend/dashboard` y rutas ML | Relaciona modelo, corrida, artefacto, feature set y ejecuciones. |

## Ciclo de vida que debe entender el usuario

### 1. Datos reales

Que debe ver el usuario:

- Granja y estanque seleccionados.
- Variables disponibles con registros, unidad, fecha inicial, fecha final y completitud.
- Aviso claro si una variable esta lista para entrenamiento o si falta.

Rutas:

- `GET /datasets/sources`
- `GET /datasets/coverage?pond_id={pond_id}`
- `GET /datasets/variables?pond_id={pond_id}`
- `GET /datasets/readiness?pond_id={pond_id}&model_code={model_code}`
- `POST /datasets/sync-legacy`

Prueba de funcionamiento:

- Para `LEGACY-POND-1`, las 4 variables principales tienen 16268 registros y `trainable: true`.
- Para `ML_NONLINEAR_SVM`, el dataset esta listo y `missing_variables: []`.

Observacion:

- El frontend debe dejar de mostrar "datos" como tabla generica. Debe mostrar "Datos listos para entrenar" y "Datos que bloquean entrenamiento".

### 2. Limpieza de datos

Que debe ver el usuario:

- Boton principal: `Crear limpieza nueva`.
- Boton secundario: `Autorrellenar con ultima configuracion`.
- Metodo usado, explicado en lenguaje corto:
  - Interpolacion lineal: completa huecos temporales.
  - Regla 3 sigma: detecta valores extremos.
  - MinMax: normaliza variables para entrenamiento.
  - Persistencia: guarda la corrida y las mediciones limpias.
- Conteo de entrada, salida, interpolados, outliers y normalizados.
- Comparacion visual antes/despues por variable.

Rutas:

- `GET /data/cleaning-runs`
- `POST /data/cleaning-runs`
- `GET /data/cleaning-runs/{run_id}/summary`
- `GET /data/cleaning-runs/{run_id}/preview`

Persistencia esperada:

- Tabla general de mediciones limpias: `clean_measurements`.
- Tabla de corrida MLOps: `cleaning_run_measurements`.
- La corrida no debe sobrescribir datos legacy. Debe quedar versionada por `cleaning_run_id`.

Prueba de funcionamiento:

- Corrida `CLEANRUN-6e89418f-d239-4639-a458-33cd39a3526d`:
  - `records_in: 63256`
  - `records_out: 63256`
  - `outliers_detected: 1637`
  - `steps: load_raw_measurements, interpolation, sigma3, minmax, persist_clean_measurements`

Observacion:

- Si el usuario no ve el metodo de limpieza y el antes/despues, no puede confiar en el dataset. La limpieza debe ser una pantalla visual, no solo una tabla.

### 3. Preparacion de features

Que debe ver el usuario:

- Feature set seleccionado.
- De que limpieza viene.
- Target.
- Variables predictoras.
- Split train/validacion/test.
- Ranking Pearson o importancia inicial de variables.
- Boton: `Crear feature set desde esta limpieza`.

Rutas:

- `GET /features`
- `POST /features/build`
- `GET /features/{feature_set_id}`
- `GET /features/{feature_set_id}/preview`
- `GET /features/{feature_set_id}/columns`

Prueba de funcionamiento:

- Feature set `FEATURESET-f33cafa1-b5d6-40a8-8983-e7c35a846335`:
  - target: `ph`
  - features: `water_temperature_c`, `nitrate_ion`, `dissolved_oxygen_mg_l`
  - rows: 15813
  - train: 11069
  - validation: 2371
  - test: 2373
  - Pearson: `nitrate_ion` 0.0684, `dissolved_oxygen_mg_l` 0.0160, `water_temperature_c` 0.0053

Observacion:

- El frontend debe explicar que el feature set es la "mesa preparada para entrenar". Sin esa frase, el flujo se siente abstracto.

### 4. Entrenamiento

Que debe ver el usuario:

- Modelos entrenables para el estanque actual.
- Estado por modelo: `Listo para entrenar`, `Ya tiene artefacto`, `Faltan datos`, `Requiere artefacto externo`.
- Boton por modelo: `Autorrellenar prueba`.
- Boton por modelo: `Entrenar candidato`.
- Barra por etapas:
  - Datos recibidos
  - Limpieza asociada
  - Features cargadas
  - Entrenamiento
  - Validacion
  - Artefacto creado
- Log tecnico desplegable, no dominante.

Rutas:

- `GET /ml/trainable-models`
- `GET /ml/training-jobs`
- `POST /ml/training-jobs`
- `GET /ml/training-jobs/{job_id}/events`

Prueba de funcionamiento:

- Hay 13 modelos listados.
- Hay 10 entrenamientos registrados.
- Ejemplo SVM:
  - job: `TRAINJOB-e3567d27-9a16-4510-b398-918c14f88526`
  - status: `completed`
  - feature set: `FEATURESET-f33cafa1-b5d6-40a8-8983-e7c35a846335`
  - asset: `ASSET-190e5c3c-58bd-43db-b6f3-dab454d12893`
  - metricas: `r2: -3.2641`, `mae: 0.2360`, `rmse: 0.2563`

Observacion critica:

- Un modelo completado no significa "bueno". El SVM activo tiene R2 negativo y debe verse como experimental o no recomendado. El frontend debe separar `entrenado` de `apto para produccion`.

### 5. Artefactos y produccion

Que debe ver el usuario:

- Artefacto activo por modelo.
- Version.
- Fecha de creacion y activacion.
- Feature set usado.
- Job de entrenamiento de origen.
- Metricas.
- Acciones seguras:
  - `Activar como champion`
  - `Deprecar`
  - `Ver trazabilidad`

Rutas:

- `GET /ml/model-assets?include_payload=false`
- `GET /ml/model-assets?status=active&include_payload=false`
- `POST /ml/model-assets/{asset_id}/activate`
- `POST /ml/model-assets/{asset_id}/deprecate`

Prueba de funcionamiento:

- Hay 9 artefactos totales.
- Hay 8 artefactos activos.
- Las acciones seguras existen como activar y deprecar.

Observacion:

- No hay eliminacion dura de modelos expuesta. Eso es correcto para auditoria. El frontend no debe decir "Eliminar"; debe decir "Deprecar / sacar de produccion".

### 6. Inferencia

Que debe ver el usuario:

- Modelo activo.
- Entrada manual guiada y boton `Usar ultima lectura real`.
- Boton `Autorrellenar prueba`.
- Resultado numerico.
- Intervalo/confianza si el backend lo entrega.
- Grafico observado vs predicho.
- Serie temporal de proyeccion cuando el modelo tenga horizonte.
- Guardado de resultado.

Rutas:

- `POST /models/{model_code}/predict`
- Para runners deterministas:
  - `GET /models/{model_code}/input-audit`
  - `GET /models/{model_code}/test-payload`
  - `POST /models/{model_code}/test-run`
  - `POST /models/{model_code}/run`

Prueba de funcionamiento:

- El dashboard entrega inputs reales actuales:
  - OD: 7.22 mg/L
  - pH: 7.36
  - temperatura: 29.0 degC
  - nitrato: 14000.0 en unidad de origen

Observacion:

- La inferencia no debe ser un formulario aislado. Debe decir: "Este resultado viene del artefacto X, entrenado con el feature set Y, desde la limpieza Z".

### 7. Trazabilidad

Que debe ver el usuario:

- Linea de auditoria por modelo:
  - Datos
  - Limpieza
  - Feature set
  - Entrenamiento
  - Validacion
  - Artefacto
  - Produccion
  - Inferencias
- Boton: `Ver evidencia completa`.
- Exportar reporte tecnico.

Rutas:

- `GET /frontend/dashboard`
- `GET /ml/training-jobs`
- `GET /ml/model-assets?include_payload=false`
- `GET /data/cleaning-runs`
- `GET /features`

Prueba de funcionamiento:

- El dashboard ya devuelve `traceability`.
- Los jobs guardan `feature_set_id`, `asset_id`, `metrics`, timestamps y errores.
- Los artefactos guardan `training_job_id`, `feature_set_id`, version y estado.

Observacion:

- La trazabilidad existe, pero debe ser clicable desde cualquier tarjeta de modelo. Ahora puede sentirse como un modulo aparte.

## Brechas originales de frontend y cierre aplicado

| Brecha | Impacto para usuario no tecnico | Cierre aplicado |
|---|---|---|
| Flujo disperso por modulos | No sabe que hacer primero ni despues. | `Modelos ML` muestra ciclo completo datos -> limpieza -> features -> entrenamiento -> validacion -> artefacto -> produccion -> inferencia. |
| Limpieza poco explicada | No entiende que formula/metodo se aplico. | El pipeline muestra limpieza como etapa propia y la evidencia enlaza corrida, feature set y entrenamiento. |
| Entrenamiento sin barra dominante | No percibe progreso ni etapas. | Stepper visual de ciclo backend con estados por etapa. |
| Modelos entrenados mezclados con modelos buenos | Puede usar modelos malos en demo o decision. | El modelo muestra confianza, MAE, R2 y recomendacion; R2 negativo se presenta como advertencia experimental. |
| Trazabilidad separada | La evidencia no acompana cada resultado. | La tarjeta del modelo y la linea de auditoria exponen asset, job, feature set, version e inferencias guardadas. |
| Graficos insuficientes | Productores no ven proyeccion ni valor practico. | Grafica principal observado vs predicho, bandas optimo/alerta/critico, grafica de error y ranking de variables. |
| Botones de prueba poco visibles | No se puede demostrar rapido. | Boton `Autorrellenar prueba`, `Usar ultima` por variable y `Ejecutar inferencia`. |
| Modelos condicionados no explicados | Parece que el sistema falla. | Catalogo separa champion, candidatos, entrenados, activos y experimentales. |

## Plan riguroso de comprobabilidad

### Prueba A: Usuario ajeno a sistemas

Objetivo: una persona tecnica de crianza debe operar el flujo sin abrir consola ni leer codigo.

Pasos esperados:

1. Selecciona granja y estanque.
2. Ve si los datos estan listos.
3. Ejecuta o selecciona una limpieza.
4. Ve antes/despues de limpieza.
5. Crea un feature set.
6. Elige un modelo entrenable.
7. Autorrellena configuracion.
8. Entrena candidato.
9. Observa barra de entrenamiento.
10. Compara metricas.
11. Activa o no activa el artefacto.
12. Ejecuta inferencia con ultima lectura real.
13. Ve grafico observado vs predicho.
14. Abre trazabilidad completa.

Criterio de aprobacion:

- El usuario puede explicar en una frase que datos uso, que limpieza aplico, que modelo entreno, que resultado obtuvo y si el modelo es confiable.

### Prueba B: Evidencia tecnica por ruta

Objetivo: cada tarjeta del frontend debe poder demostrar su origen.

Checklist:

- Tarjeta de datos tiene enlace a `GET /datasets/variables`.
- Tarjeta de limpieza tiene enlace a `GET /data/cleaning-runs/{run_id}/summary`.
- Tarjeta de features tiene enlace a `GET /features/{feature_set_id}/columns`.
- Tarjeta de entrenamiento tiene enlace a `GET /ml/training-jobs/{job_id}` o lista de jobs.
- Tarjeta de artefacto tiene enlace a `GET /ml/model-assets`.
- Tarjeta de inferencia muestra `model_code`, `asset_id`, `feature_set_id` y timestamp.

Criterio de aprobacion:

- Ningun numero importante aparece sin ruta de origen.

### Prueba C: Persistencia

Objetivo: demostrar que el flujo guarda datos y no es solo simulacion visual.

Checklist:

- Una limpieza nueva genera `cleaning_run_id`.
- La limpieza guarda mediciones asociadas a la corrida.
- Un feature set nuevo referencia `cleaning_run_id`.
- Un entrenamiento referencia `feature_set_id`.
- Un artefacto referencia `training_job_id`.
- Una inferencia referencia `model_code` y, si aplica, `asset_id`.

Criterio de aprobacion:

- Se puede reconstruir la cadena completa: `cleaning_run_id -> feature_set_id -> training_job_id -> asset_id -> prediction`.

### Prueba D: Calidad cientifica minima

Objetivo: evitar mostrar como valido un modelo matematicamente pobre.

Checklist:

- Si R2 es negativo, mostrar etiqueta `No recomendado`.
- Si MAE/RMSE son aceptables pero R2 falla, mostrar advertencia.
- Si un target tiene varianza casi cero, avisar que la metrica puede enganar.
- Si el modelo requiere artefacto externo, mostrar `No productivo aun`.
- Si falta una variable, mostrar formulario o dato requerido.

Criterio de aprobacion:

- El frontend nunca debe llamar "validado" a un modelo solo porque termino de entrenar.

## Modulo Modelos ML implementado

Pantalla unica disponible:

1. Cabecera: modelo champion, confianza, ultima inferencia, MAE, R2 y recomendacion.
2. Pipeline: datos, limpieza, features, entrenamiento, validacion, artefacto, produccion, inferencia.
3. Catalogo: modelos activos, candidatos, bloqueados y condicionados.
4. Grafico principal: observado vs predicho con rango optimo, alerta y critico.
5. Comparador: MAE, RMSE, R2, estabilidad y recomendacion.
6. Panel de prueba: usar ultima lectura real, autorrellenar prueba, ejecutar inferencia.
7. Trazabilidad: linea de auditoria clicable y exportable.

## Estado final de comprobabilidad

| Area | Estado actual | Decision |
|---|---|---|
| Backend MLOps | Funcional | Usable desde frontend. |
| Datos MySQL | Funcionales | Hay datos reales suficientes para modelos tabulares actuales. |
| Limpieza | Funcional | Integrada al pipeline y trazabilidad. |
| Feature sets | Funcional | Integrados a preparacion visual del modelo. |
| Entrenamiento | Funcional | Stepper de ciclo y eventos disponibles. |
| Artefactos | Funcional | Usar activar/deprecar, no eliminar duro. |
| Inferencia | Funcional | Formulario guiado, autorrelleno y resultado trazable. |
| Trazabilidad | Funcional | Integrada por modelo, pipeline y resultado. |
| Experiencia no tecnica | Operativa | Lenguaje y flujo enfocados en productor tecnico. |

## Conclusion

El ciclo real existe y el frontend queda preparado para operarlo desde `Modelos ML`. Cada resultado visible debe poder explicarse desde datos reales, limpieza guardada, feature set, entrenamiento, artefacto versionado e inferencia trazada.

Siguiente trabajo recomendado: mejorar entrenamiento asincrono con barra de progreso en vivo si se decide mover jobs largos a cola/background worker.
