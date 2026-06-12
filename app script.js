// ============================================================
// TRIVIA MUNDIALISTA — Google Apps Script (Backend)
// Pega este código en: script.google.com → Nuevo proyecto
//
// PASOS DE CONFIGURACIÓN:
//   1. Abre script.google.com y crea un nuevo proyecto.
//   2. Pega todo este código.
//   3. Cambia SPREADSHEET_ID por el ID de tu Google Sheet.
//   4. Cambia ADMIN_EMAIL por tu correo administrativo.
//   5. Haz clic en "Implementar" → "Nueva implementación".
//   6. Tipo: Aplicación web. Acceso: Cualquier persona.
//   7. Copia la URL generada y pégala en script.js (APPS_SCRIPT_URL).
// ============================================================

//  ASÍ ES COMO DEBE QUEDAR:
var SPREADSHEET_ID = '1Kzj6LG_DP7lnkz1fIITnhOXhc6_cECgE-CJkiH8R3Us';
var ADMIN_EMAIL    = 'ecuadorpropuestaaccion@gmail.com';

// ── Nombres de las hojas ─────────────────────────────────────
var HOJA_PARTICIPANTES = 'Participantes';
var HOJA_PRONOSTICOS   = 'Pronósticos';
var HOJA_RESULTADOS    = 'Resultados';

// ============================================================
// doPost() — Punto de entrada principal para peticiones POST
// Recibe JSON con { accion, datos } y delega a la función correcta.
// ============================================================
function doPost(e) {
  var respuesta;
  try {
    var body   = JSON.parse(e.postData.contents);
    var accion = body.accion;
    var datos  = body.datos;

    if      (accion === 'registrar')          respuesta = registrarParticipante(datos);
    else if (accion === 'guardarPronosticos') respuesta = guardarPronosticos(datos);
    else if (accion === 'verificarCorreo')    respuesta = verificarCorreo(datos.correo);
    else if (accion === 'obtenerParticipantes') respuesta = obtenerParticipantes(datos);
    else if (accion === 'obtenerPronosticos')   respuesta = obtenerPronosticos(datos);
    else if (accion === 'registrarResultado')   respuesta = registrarResultado(datos);
    else if (accion === 'obtenerGanadores')     respuesta = obtenerGanadores();
    else                                         respuesta = { ok: false, error: 'Acción desconocida: ' + accion };

  } catch (err) {
    respuesta = { ok: false, error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

// doGet() — permite verificar que el script está activo
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, mensaje: 'Trivia Mundialista API activa' }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// PARTICIPANTES
// ============================================================

function registrarParticipante(datos) {
  inicializarHojas();
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = ss.getSheetByName(HOJA_PARTICIPANTES);

  // Verificar duplicado por correo
  var correos = hoja.getRange(2, 3, Math.max(hoja.getLastRow() - 1, 1), 1).getValues().flat();
  if (correos.indexOf(datos.correo.toLowerCase().trim()) !== -1) {
    return { ok: false, error: 'Ya existe un registro con ese correo electrónico.' };
  }

  var ahora = new Date();
  var fila  = [
    datos.nombre.trim(),
    datos.telefono.trim(),
    datos.correo.toLowerCase().trim(),
    Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    'Pendiente'   // estado de pronóstico
  ];

  hoja.appendRow(fila);

  // Enviar correo de bienvenida al participante
  enviarCorreoBienvenida(datos, ahora);

  return { ok: true, mensaje: 'Registro exitoso', fecha: ahora.toISOString() };
}

function verificarCorreo(correo) {
  inicializarHojas();
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja    = ss.getSheetByName(HOJA_PARTICIPANTES);
  var lastRow = hoja.getLastRow();
  if (lastRow < 2) return { ok: true, existe: false };

  var numFilas = lastRow - 1;
  var correos  = hoja.getRange(2, 3, numFilas, 1).getValues().flat();
  var existe   = correos.indexOf(correo.toLowerCase().trim()) !== -1;
  return { ok: true, existe: existe };
}

function obtenerParticipantes(filtros) {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja    = ss.getSheetByName(HOJA_PARTICIPANTES);
  var lastRow = hoja.getLastRow();
  if (lastRow < 2) return { ok: true, datos: [] };

  var filas = hoja.getRange(2, 1, lastRow - 1, 5).getValues();
  var lista = filas.map(function(f) {
    return { nombre: f[0], telefono: f[1], correo: f[2], fecha: f[3], estado: f[4] };
  });

  // Aplicar filtros
  if (filtros && filtros.busqueda) {
    var q = filtros.busqueda.toLowerCase();
    lista = lista.filter(function(p) {
      return p.nombre.toLowerCase().indexOf(q) !== -1 ||
             p.correo.toLowerCase().indexOf(q) !== -1 ||
             p.telefono.indexOf(q) !== -1;
    });
  }

  return { ok: true, datos: lista };
}


// ============================================================
// PRONÓSTICOS
// ============================================================

function guardarPronosticos(datos) {
  inicializarHojas();
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hojaP = ss.getSheetByName(HOJA_PRONOSTICOS);
  var hojaP2 = ss.getSheetByName(HOJA_PARTICIPANTES);

  // Verificar que el correo existe
  var lastRow2 = hojaP2.getLastRow();
  if (lastRow2 < 2) return { ok: false, error: 'Participante no encontrado.' };
  var filasPart = hojaP2.getRange(2, 1, lastRow2 - 1, 5).getValues();
  var idxPart   = filasPart.findIndex(function(f) { return f[2] === datos.correo.toLowerCase().trim(); });
  if (idxPart === -1) return { ok: false, error: 'Participante no encontrado.' };

  // Verificar que no haya enviado ya pronósticos
  if (filasPart[idxPart][4] === 'Enviado') {
    return { ok: false, error: 'Ya enviaste tus pronósticos. No pueden modificarse.' };
  }

  // Guardar cada pronóstico
  var ahora = new Date();
  datos.pronosticos.forEach(function(p) {
    hojaP.appendRow([
      datos.correo.toLowerCase().trim(),
      datos.nombre,
      p.partido,
      p.equipoLocal,
      p.equipoVisitante,
      p.golesLocal,
      p.golesVisitante,
      p.resultado,
      Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')
    ]);
  });

  // Marcar participante como "Enviado"
  hojaP2.getRange(idxPart + 2, 5).setValue('Enviado');

  // Enviar correo resumen al admin y al participante
  enviarCorreoResumen(datos, ahora);

  return { ok: true, mensaje: 'Pronósticos guardados correctamente.' };
}

function obtenerPronosticos(filtros) {
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja    = ss.getSheetByName(HOJA_PRONOSTICOS);
  var lastRow = hoja.getLastRow();
  if (lastRow < 2) return { ok: true, datos: [] };

  var filas = hoja.getRange(2, 1, lastRow - 1, 9).getValues();
  var lista = filas.map(function(f) {
    return {
      correo: f[0], nombre: f[1], partido: f[2],
      local: f[3], visitante: f[4],
      golesLocal: f[5], golesVisitante: f[6],
      resultado: f[7], fecha: f[8]
    };
  });

  if (filtros && filtros.partido) {
    lista = lista.filter(function(p) { return p.partido === filtros.partido; });
  }
  if (filtros && filtros.correo) {
    lista = lista.filter(function(p) { return p.correo === filtros.correo; });
  }

  return { ok: true, datos: lista };
}


// ============================================================
// RESULTADOS Y GANADORES
// ============================================================

function registrarResultado(datos) {
  inicializarHojas();
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = ss.getSheetByName(HOJA_RESULTADOS);
  hoja.appendRow([
    datos.partido,
    datos.equipoLocal,
    datos.equipoVisitante,
    datos.golesLocal,
    datos.golesVisitante,
    datos.resultado,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')
  ]);
  return { ok: true, mensaje: 'Resultado registrado.' };
}

function obtenerGanadores() {
  var ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hojaRes  = ss.getSheetByName(HOJA_RESULTADOS);
  var hojaPron = ss.getSheetByName(HOJA_PRONOSTICOS);

  var lastRes  = hojaRes.getLastRow();
  var lastPron = hojaPron.getLastRow();

  if (lastRes < 2 || lastPron < 2) return { ok: true, ganadores: [], estadisticas: {} };

  var resultados  = hojaRes.getRange(2, 1, lastRes - 1, 7).getValues();
  var pronosticos = hojaPron.getRange(2, 1, lastPron - 1, 9).getValues();

  // Mapa de resultados oficiales por partido
  var mapRes = {};
  resultados.forEach(function(r) {
    mapRes[r[0]] = { resultado: r[5], golesLocal: r[3], golesVisitante: r[4] };
  });

  // Comparar pronósticos con resultados
  var aciertos = {}; // correo → { nombre, aciertos }
  var aciertosPorPartido = {};

  pronosticos.forEach(function(p) {
    var correo  = p[0];
    var nombre  = p[1];
    var partido = p[2];
    var resOficial = mapRes[partido];
    if (!resOficial) return;

    if (!aciertos[correo]) aciertos[correo] = { nombre: nombre, correo: correo, total: 0 };
    if (!aciertosPorPartido[partido]) aciertosPorPartido[partido] = 0;

    if (p[7] === resOficial.resultado) {
      aciertos[correo].total++;
      aciertosPorPartido[partido]++;
    }
  });

  var ranking = Object.values(aciertos).sort(function(a, b) { return b.total - a.total; });

  return {
    ok: true,
    ganadores: ranking,
    estadisticas: {
      totalParticipantes: ranking.length,
      aciertosPorPartido: aciertosPorPartido
    }
  };
}


// ============================================================
// CORREOS
// ============================================================

function enviarCorreoBienvenida(datos, fecha) {
  var cuerpo =
    'Hola ' + datos.nombre + ',\n\n' +
    '¡Te has registrado exitosamente en la Trivia Mundialista!\n\n' +
    'Tus datos de registro:\n' +
    '• Nombre: '    + datos.nombre   + '\n' +
    '• Correo: '    + datos.correo   + '\n' +
    '• Teléfono: '  + datos.telefono + '\n' +
    '• Fecha: '     + Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss') + '\n\n' +
    'Ya puedes ingresar y enviar tus pronósticos.\n\n' +
    'Recuerda: una vez enviados, los pronósticos NO podrán modificarse.\n\n' +
    '¡Mucha suerte!';

  MailApp.sendEmail({ to: datos.correo, subject: '✅ Registro Trivia Mundialista', body: cuerpo });
  MailApp.sendEmail({ to: ADMIN_EMAIL,  subject: '[Admin] Nuevo participante: ' + datos.nombre, body: cuerpo });
}

function enviarCorreoResumen(datos, fecha) {
  var listaPronosticos = datos.pronosticos.map(function(p) {
    return '• ' + p.partido + ': ' + p.equipoLocal + ' ' + p.golesLocal + ' - ' + p.golesVisitante + ' ' + p.equipoVisitante + ' (' + p.resultado + ')';
  }).join('\n');

  var cuerpo =
    'Hola ' + datos.nombre + ',\n\n' +
    'Tus pronósticos han sido registrados correctamente.\n\n' +
    'Datos del participante:\n' +
    '• Nombre: '   + datos.nombre   + '\n' +
    '• Correo: '   + datos.correo   + '\n' +
    '• Teléfono: ' + datos.telefono + '\n' +
    '• Fecha de envío: ' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss') + '\n\n' +
    'Tus pronósticos:\n' + listaPronosticos + '\n\n' +
    'IMPORTANTE: Los pronósticos ya no pueden modificarse.\n\n' +
    '¡Buena suerte en el Mundial!';

  MailApp.sendEmail({ to: datos.correo, subject: '⚽ Tus pronósticos Trivia Mundialista', body: cuerpo });
  MailApp.sendEmail({ to: ADMIN_EMAIL,  subject: '[Admin] Pronósticos de: ' + datos.nombre, body: cuerpo });
}


// ============================================================
// INICIALIZAR HOJAS (crea encabezados si no existen)
// ============================================================

function inicializarHojas() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var hojasPorDefecto = [
    {
      nombre: HOJA_PARTICIPANTES,
      encabezados: ['Nombre', 'Teléfono', 'Correo', 'Fecha Registro', 'Estado Pronóstico']
    },
    {
      nombre: HOJA_PRONOSTICOS,
      encabezados: ['Correo', 'Nombre', 'Partido', 'Equipo Local', 'Equipo Visitante', 'Goles Local', 'Goles Visitante', 'Resultado', 'Fecha Envío']
    },
    {
      nombre: HOJA_RESULTADOS,
      encabezados: ['Partido', 'Equipo Local', 'Equipo Visitante', 'Goles Local', 'Goles Visitante', 'Resultado', 'Fecha Registro']
    }
  ];

  hojasPorDefecto.forEach(function(h) {
    var hoja = ss.getSheetByName(h.nombre);
    if (!hoja) {
      hoja = ss.insertSheet(h.nombre);
      hoja.appendRow(h.encabezados);
      hoja.getRange(1, 1, 1, h.encabezados.length).setFontWeight('bold');
    }
  });
}