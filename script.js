// ============================================================
// TRIVIA MUNDIALISTA — JAIME RUIZ
// script.js — Lógica principal del sistema
//
// CONFIGURACIÓN INICIAL:
//   1. Despliega el Apps Script en Google (apps-script.gs).
//   2. Copia la URL de implementación y pégala en APPS_SCRIPT_URL.
//   3. Personaliza PARTIDOS y ADMIN_PASSWORD.
// ============================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyEAe_RPS8_4s8wrs5t2v_kUGakVhhWO_h-l9DMtNbi_Ezoft7Bg4wZjHqOfVGfXt3c/exec';
var ADMIN_PASSWORD  = 'trivia2026';   // Cambia esta contraseña

// Partidos de Ecuador (personaliza según el Mundial)
var PARTIDOS = [
  { id: 'ecu_vs_civ',  local: 'Ecuador', visitante: 'Costa de Marfil',  bandLocal: '🇪🇨', bandVisita: '🇨🇮' },
  { id: 'ecu_vs_cur',  local: 'Ecuador', visitante: 'Curazao',          bandLocal: '🇪🇨', bandVisita: '🇨🇼' },
  { id: 'ecu_vs_ger',  local: 'Ecuador', visitante: 'Alemania',         bandLocal: '🇪🇨', bandVisita: '🇩🇪' }
];

// ── ESTADO DE LA APLICACIÓN ──────────────────────────────────
var estado = {
  participante: null,   // { nombre, correo, telefono }
  yaEnvio:      false,
  adminLogueado: false
};

// Datos en memoria para el panel admin
var _cacheParticipantes = [];
var _cachePronosticos   = [];


// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  construirPartidos();
  inicializarEventos();
  poblarSelectoresAdmin();
  restaurarEstado();
});

// ── PERSISTENCIA LOCAL (localStorage) ────────────────────────
var LS_KEY = 'triviaMundialistaEstado';

function guardarEstadoLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      participante: estado.participante,
      yaEnvio: estado.yaEnvio
    }));
  } catch (e) { /* almacenamiento no disponible */ }
}

function restaurarEstado() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    var datos = JSON.parse(raw);
    if (datos && datos.participante) {
      estado.participante = datos.participante;
      estado.yaEnvio = !!datos.yaEnvio;
      document.getElementById('chipNombre').textContent = datos.participante.nombre.split(' ')[0];
      if (estado.yaEnvio) {
        irAPantalla('pantallaConfirmacion');
      } else {
        irAPantalla('pantallaPronosticos');
      }
    }
  } catch (e) { /* datos corruptos o no disponibles */ }
}


// ============================================================
// CONSTRUIR PARTIDOS DINÁMICAMENTE
// ============================================================

function construirPartidos() {
  var lista = document.getElementById('listaPartidos');
  lista.innerHTML = '';

  PARTIDOS.forEach(function(p) {
    var card = document.createElement('div');
    card.className = 'partido-card';
    card.innerHTML =
      '<div class="partido-equipos">' +
        '<div class="equipo-nombre">' + p.bandLocal + ' ' + p.local + '</div>' +
        '<div class="partido-vs">VS</div>' +
        '<div class="equipo-nombre derecha">' + p.visitante + ' ' + p.bandVisita + '</div>' +
      '</div>' +
      '<div class="partido-marcador">' +
        '<input type="number" class="marcador-input" id="gol_' + p.id + '_local" min="0" max="20" value="" placeholder="0" />' +
        '<span class="marcador-guion">—</span>' +
        '<input type="number" class="marcador-input" id="gol_' + p.id + '_visita" min="0" max="20" value="" placeholder="0" />' +
      '</div>' +
      '<div class="resultado-radio-group">' +
        '<div class="radio-opcion">' +
          '<input type="radio" name="res_' + p.id + '" id="res_' + p.id + '_L" value="Local" />' +
          '<label for="res_' + p.id + '_L"> ' + p.local + '</label>' +
        '</div>' +
        '<div class="radio-opcion">' +
          '<input type="radio" name="res_' + p.id + '" id="res_' + p.id + '_E" value="Empate" />' +
          '<label for="res_' + p.id + '_E"> Empate</label>' +
        '</div>' +
        '<div class="radio-opcion">' +
          '<input type="radio" name="res_' + p.id + '" id="res_' + p.id + '_V" value="Visitante" />' +
          '<label for="res_' + p.id + '_V"> ' + p.visitante + '</label>' +
        '</div>' +
      '</div>';
    lista.appendChild(card);
  });
}

function poblarSelectoresAdmin() {
  var selPartido   = document.getElementById('filtroPartido');
  var selResPartido = document.getElementById('resPartido');

  PARTIDOS.forEach(function(p) {
    var etiqueta = p.local + ' vs ' + p.visitante;
    [selPartido, selResPartido].forEach(function(sel) {
      var opt = document.createElement('option');
      opt.value       = etiqueta;
      opt.textContent = etiqueta;
      sel.appendChild(opt);
    });
  });

  // Partidos extra para finales
  var extras = ['Semifinal 1', 'Semifinal 2', 'Final'];
  extras.forEach(function(e) {
    [selPartido, selResPartido].forEach(function(sel) {
      var opt = document.createElement('option');
      opt.value = e; opt.textContent = e;
      sel.appendChild(opt);
    });
  });
}


// ============================================================
// EVENTOS
// ============================================================

function inicializarEventos() {
  // Habilitar botón REGISTRARME cuando acepta política
  document.getElementById('chkPolitica').addEventListener('change', function() {
    document.getElementById('btnRegistrar').disabled = !this.checked;
  });

  // Habilitar botón ENVIAR cuando acepta política
  document.getElementById('chkPoliticaPron').addEventListener('change', function() {
    document.getElementById('btnEnviarPron').disabled = !this.checked;
  });

  // Botón registrar
  document.getElementById('btnRegistrar').addEventListener('click', registrarParticipante);

  // Botón enviar pronósticos → muestra confirmación antes
  document.getElementById('btnEnviarPron').addEventListener('click', mostrarConfirmacionEnvio);

  // Modal política
  document.getElementById('linkPolitica').addEventListener('click', function(e) { e.preventDefault(); abrirModal(); });
  document.getElementById('linkPolitica2').addEventListener('click', function(e) { e.preventDefault(); abrirModal(); });

  // Ya registrado
  document.getElementById('linkYaRegistrado').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('modalYaRegistrado').style.display = 'flex';
  });

  // Actualizar etiqueta de resultados admin al cambiar partido
  document.getElementById('resPartido').addEventListener('change', function() {
    var val = this.value;
    var partido = PARTIDOS.find(function(p) {
      return (p.local + ' vs ' + p.visitante) === val;
    });
    if (partido) {
      document.getElementById('resLabelLocal').textContent    = partido.local;
      document.getElementById('resLabelVisitante').textContent = partido.visitante;
    } else {
      document.getElementById('resLabelLocal').textContent    = 'Goles Local';
      document.getElementById('resLabelVisitante').textContent = 'Goles Visitante';
    }
  });
}


// ============================================================
// REGISTRO
// ============================================================

function registrarParticipante() {
  var nombre   = document.getElementById('regNombre').value.trim();
  var correo   = document.getElementById('regCorreo').value.trim().toLowerCase();
  var telefono = document.getElementById('regTelefono').value.trim();

  // Validaciones
  if (!nombre || nombre.length < 3) {
    mostrarToast('Por favor ingresa tu nombre completo.', 'error'); return;
  }
  if (!validarCorreo(correo)) {
    mostrarToast('Ingresa un correo electrónico válido.', 'error'); return;
  }
  if (!validarTelefono(telefono)) {
    mostrarToast('Ingresa un número de teléfono válido (mínimo 7 dígitos).', 'error'); return;
  }

  setBotonCargando('btnRegistrar', true);

  llamarAPI('registrar', { nombre: nombre, correo: correo, telefono: telefono }, function(resp) {
    setBotonCargando('btnRegistrar', false);
    if (resp.ok) {
      estado.participante = { nombre: nombre, correo: correo, telefono: telefono };
      guardarEstadoLocal();
      mostrarToast('¡Registro exitoso! Ahora completa tus pronósticos.', 'exito');
      setTimeout(function() { irAPantalla('pantallaPronosticos'); }, 1200);
      document.getElementById('chipNombre').textContent = '👤 ' + nombre.split(' ')[0];
    } else {
      mostrarToast(resp.error || 'Error al registrar. Intenta de nuevo.', 'error');
    }
  });
}


// ============================================================
// PRONÓSTICOS
// ============================================================

function recopilarPronosticos() {
  var pronosticos = [];
  var valido      = true;
  var mensajeErr  = '';

  PARTIDOS.forEach(function(p) {
    var golLocal  = document.getElementById('gol_' + p.id + '_local').value;
    var golVisita = document.getElementById('gol_' + p.id + '_visita').value;
    var resultado = document.querySelector('input[name="res_' + p.id + '"]:checked');

    if (golLocal === '' || golVisita === '' || !resultado) {
      valido = false;
      mensajeErr = 'Completa el marcador y resultado para: ' + p.local + ' vs ' + p.visitante;
    } else {
      pronosticos.push({
        partido:        p.local + ' vs ' + p.visitante,
        equipoLocal:    p.local,
        equipoVisitante: p.visitante,
        golesLocal:     parseInt(golLocal),
        golesVisitante: parseInt(golVisita),
        resultado:      resultado.value
      });
    }
  });

  // Finalistas y campeón
  var f1      = document.getElementById('finalista1').value.trim();
  var f2      = document.getElementById('finalista2').value.trim();
  var campeon = document.getElementById('campeonMundial').value.trim();

  if (!f1 || !f2) { valido = false; mensajeErr = 'Indica los dos equipos finalistas.'; }
  if (!campeon)   { valido = false; mensajeErr = 'Indica el equipo campeón del mundial.'; }

  if (!valido) { mostrarToast(mensajeErr, 'error'); return null; }

  pronosticos.push({ partido: 'Final', equipoLocal: f1, equipoVisitante: f2, golesLocal: 0, golesVisitante: 0, resultado: 'TBD' });
  pronosticos.push({ partido: 'Campeón', equipoLocal: campeon, equipoVisitante: '', golesLocal: 0, golesVisitante: 0, resultado: campeon });

  return pronosticos;
}

function mostrarConfirmacionEnvio() {
  var pron = recopilarPronosticos();
  if (!pron) return;
  document.getElementById('modalConfirmarEnvio').style.display = 'flex';
}

function cerrarModalEnvio() {
  document.getElementById('modalConfirmarEnvio').style.display = 'none';
}

function confirmarEnvioFinal() {
  cerrarModalEnvio();
  var pron = recopilarPronosticos();
  if (!pron) return;

  if (!estado.participante) {
    mostrarToast('Sesión expirada. Por favor regístrate de nuevo.', 'error');
    irAPantalla('pantallaRegistro');
    return;
  }

  setBotonCargando('btnEnviarPron', true);

  var datos = {
    nombre:      estado.participante.nombre,
    correo:      estado.participante.correo,
    telefono:    estado.participante.telefono,
    pronosticos: pron
  };

  llamarAPI('guardarPronosticos', datos, function(resp) {
    setBotonCargando('btnEnviarPron', false);
    if (resp.ok) {
      estado.yaEnvio = true;
      guardarEstadoLocal();
      irAPantalla('pantallaConfirmacion');
    } else {
      mostrarToast(resp.error || 'Error al guardar pronósticos. Intenta de nuevo.', 'error');
    }
  });
}

function mostrarConfirmacionFinal(datos) {
  // Pantalla limpia — sin detalle de pronósticos
}


// ============================================================
// VERIFICAR YA REGISTRADO
// ============================================================

function verificarYaRegistrado() {
  var correo = document.getElementById('correoYaRegistrado').value.trim().toLowerCase();
  if (!validarCorreo(correo)) {
    mostrarToast('Ingresa un correo válido.', 'error'); return;
  }

  llamarAPI('verificarCorreo', { correo: correo }, function(resp) {
    if (resp.ok && resp.existe) {
      // Buscar datos del participante
      llamarAPI('obtenerParticipantes', { busqueda: correo }, function(resp2) {
        var part = resp2.datos && resp2.datos.find(function(p) { return p.correo === correo; });
        if (part) {
          estado.participante = { nombre: part.nombre, correo: part.correo, telefono: part.telefono };
          estado.yaEnvio      = part.estado === 'Enviado';
          guardarEstadoLocal();

          cerrarModalYaRegistrado();

          if (estado.yaEnvio) {
            mostrarToast('Ya enviaste tus pronósticos. No pueden modificarse.', 'error');
          } else {
            mostrarToast('¡Bienvenido de nuevo, ' + part.nombre.split(' ')[0] + '!', 'exito');
            document.getElementById('chipNombre').textContent = '👤 ' + part.nombre.split(' ')[0];
            setTimeout(function() { irAPantalla('pantallaPronosticos'); }, 1000);
          }
        } else {
          mostrarToast('No se encontró ese correo. Por favor regístrate.', 'error');
        }
      });
    } else {
      mostrarToast('Este correo no está registrado. Por favor regístrate primero.', 'error');
    }
  });
}

function cerrarModalYaRegistrado() {
  document.getElementById('modalYaRegistrado').style.display = 'none';
}


// ============================================================
// PANEL ADMIN
// ============================================================

function mostrarLoginAdmin() {
  document.getElementById('modalLoginAdmin').style.display = 'flex';
}

function loginAdmin() {
  var pass = document.getElementById('adminPassword').value;
  if (pass === ADMIN_PASSWORD) {
    document.getElementById('modalLoginAdmin').style.display = 'none';
    estado.adminLogueado = true;
    irAPantalla('pantallaAdmin');
    cargarParticipantes();
  } else {
    mostrarToast('Contraseña incorrecta.', 'error');
  }
}

function salirAdmin() {
  estado.adminLogueado = false;
  irAPantalla('pantallaRegistro');
}

function cambiarTab(nombre) {
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('activa'); });
  document.querySelectorAll('.tab-contenido').forEach(function(t) { t.classList.remove('activo'); });

  var mapa = { participantes: 0, pronosticos: 1, resultados: 2, ganadores: 3 };
  document.querySelectorAll('.admin-tab')[mapa[nombre]].classList.add('activa');
  document.getElementById('tab' + capitalizar(nombre)).classList.add('activo');

  if (nombre === 'participantes') cargarParticipantes();
  if (nombre === 'pronosticos')   cargarPronosticos();
}

function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Participantes ────────────────────────────────────────────

function cargarParticipantes(filtro) {
  var tbody = document.getElementById('bodyParticipantes');
  tbody.innerHTML = '<tr><td colspan="5" class="sin-datos"><span class="dot-spin"></span> Cargando...</td></tr>';

  llamarAPI('obtenerParticipantes', { busqueda: filtro || '' }, function(resp) {
    _cacheParticipantes = resp.datos || [];
    renderTablaParticipantes(_cacheParticipantes);
  });
}

function buscarParticipantes() {
  var q = document.getElementById('busquedaParticipante').value.trim();
  cargarParticipantes(q);
}

function renderTablaParticipantes(lista) {
  var tbody = document.getElementById('bodyParticipantes');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="sin-datos">Sin resultados.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(function(p) {
    var estadoClass = p.estado === 'Enviado' ? 'estado-enviado' : 'estado-pendiente';
    return '<tr>' +
      '<td>' + escHTML(p.nombre) + '</td>' +
      '<td>' + escHTML(p.correo) + '</td>' +
      '<td>' + escHTML(p.telefono) + '</td>' +
      '<td>' + escHTML(p.fecha) + '</td>' +
      '<td class="' + estadoClass + '">' + escHTML(p.estado) + '</td>' +
    '</tr>';
  }).join('');
}

// ── Pronósticos ──────────────────────────────────────────────

function cargarPronosticos(partido) {
  var tbody = document.getElementById('bodyPronosticos');
  tbody.innerHTML = '<tr><td colspan="4" class="sin-datos"><span class="dot-spin"></span> Cargando...</td></tr>';

  llamarAPI('obtenerPronosticos', { partido: partido || '' }, function(resp) {
    _cachePronosticos = resp.datos || [];
    renderTablaPronosticos(_cachePronosticos);
  });
}

function filtrarPronosticos() {
  var partido = document.getElementById('filtroPartido').value;
  cargarPronosticos(partido);
}

function renderTablaPronosticos(lista) {
  var tbody = document.getElementById('bodyPronosticos');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="sin-datos">Sin resultados.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(function(p) {
    var marcador = p.partido === 'Campeón' ? p.local :
                   p.partido === 'Final'   ? p.local + ' vs ' + p.visitante :
                   p.golesLocal + ' - ' + p.golesVisitante + ' (' + p.resultado + ')';
    return '<tr>' +
      '<td>' + escHTML(p.nombre) + '<br/><small style="color:rgba(255,255,255,0.4)">' + escHTML(p.correo) + '</small></td>' +
      '<td>' + escHTML(p.partido) + '</td>' +
      '<td>' + escHTML(marcador) + '</td>' +
      '<td>' + escHTML(p.fecha) + '</td>' +
    '</tr>';
  }).join('');
}

// ── Registrar resultado ──────────────────────────────────────

function guardarResultado() {
  var partido   = document.getElementById('resPartido').value;
  var golLocal  = parseInt(document.getElementById('resGolesLocal').value);
  var golVisita = parseInt(document.getElementById('resGolesVisitante').value);

  if (!partido) { mostrarToast('Selecciona un partido.', 'error'); return; }

  var resultado = golLocal > golVisita ? 'Local' :
                  golLocal < golVisita ? 'Visitante' : 'Empate';

  var p = PARTIDOS.find(function(x) { return (x.local + ' vs ' + x.visitante) === partido; });
  var local     = p ? p.local     : partido;
  var visitante = p ? p.visitante : '';

  llamarAPI('registrarResultado', {
    partido: partido,
    equipoLocal: local,
    equipoVisitante: visitante,
    golesLocal: golLocal,
    golesVisitante: golVisita,
    resultado: resultado
  }, function(resp) {
    if (resp.ok) mostrarToast('Resultado guardado: ' + resultado, 'exito');
    else mostrarToast(resp.error || 'Error al guardar.', 'error');
  });
}

// ── Ganadores ────────────────────────────────────────────────

function cargarGanadores() {
  var cont = document.getElementById('contenidoGanadores');
  cont.innerHTML = '<div class="cargando"><span class="dot-spin"></span> Calculando ganadores...</div>';

  llamarAPI('obtenerGanadores', {}, function(resp) {
    if (!resp.ok) { cont.innerHTML = '<p class="sin-datos">Error al calcular.</p>'; return; }

    var ganadores = resp.ganadores || [];
    var stats     = resp.estadisticas || {};

    if (!ganadores.length) {
      cont.innerHTML = '<p class="sin-datos">No hay datos suficientes para calcular ganadores.</p>';
      return;
    }

    var medallas = ['🥇', '🥈', '🥉'];
    var clases   = ['oro', 'plata', 'bronce'];

    var html =
      '<div style="background:var(--azul-medio);border-radius:10px;padding:14px;margin-bottom:14px;">' +
      '<strong style="color:var(--dorado)">📊 Estadísticas</strong><br/>' +
      'Total participantes: ' + (stats.totalParticipantes || 0) + '</div>';

    html += '<ul class="ranking-lista">';
    ganadores.forEach(function(g, i) {
      var medalla = medallas[i] || (i + 1);
      var clase   = clases[i] || '';
      html +=
        '<li class="ranking-item">' +
          '<span class="ranking-pos ' + clase + '">' + medalla + '</span>' +
          '<div>' +
            '<div class="ranking-nombre">' + escHTML(g.nombre) + '</div>' +
            '<div class="ranking-correo">' + escHTML(g.correo) + '</div>' +
          '</div>' +
          '<span class="ranking-aciertos">' + g.total + ' ✓</span>' +
        '</li>';
    });
    html += '</ul>';

    cont.innerHTML = html;
  });
}


// ============================================================
// EXPORTAR CSV
// ============================================================

function exportarCSV(tipo) {
  var datos, encabezados, nombre;

  if (tipo === 'participantes') {
    encabezados = ['Nombre', 'Correo', 'Teléfono', 'Fecha Registro', 'Estado'];
    datos       = _cacheParticipantes.map(function(p) {
      return [p.nombre, p.correo, p.telefono, p.fecha, p.estado];
    });
    nombre = 'participantes_trivia.csv';
  } else {
    encabezados = ['Nombre', 'Correo', 'Partido', 'Pronóstico', 'Fecha'];
    datos       = _cachePronosticos.map(function(p) {
      var marcador = p.partido === 'Campeón' ? p.local :
                     p.golesLocal + '-' + p.golesVisitante + ' (' + p.resultado + ')';
      return [p.nombre, p.correo, p.partido, marcador, p.fecha];
    });
    nombre = 'pronosticos_trivia.csv';
  }

  var csv = [encabezados].concat(datos).map(function(fila) {
    return fila.map(function(cel) {
      var s = String(cel || '').replace(/"/g, '""');
      return '"' + s + '"';
    }).join(',');
  }).join('\n');

  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('CSV exportado correctamente.', 'exito');
}


// ============================================================
// API — Llamadas a Google Apps Script
// ============================================================

function llamarAPI(accion, datos, callback) {
  if (APPS_SCRIPT_URL === 'https://script.google.com/macros/s/AKfycbyM5_daa0GmiO8fH5N7KVmHvwpMluhXf85KGJdfBduNWiiXURLGM7JZ_M7112OHKqvs/exec') {
    // Modo demo sin backend — simular respuestas
    simularRespuesta(accion, datos, callback);
    return;
  }

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ accion: accion, datos: datos })
  })
  .then(function(r) { return r.json(); })
  .then(callback)
  .catch(function(err) {
    console.error('[API Error]', err);
    callback({ ok: false, error: 'Error de conexión. Verifica tu conexión a internet.' });
  });
}

// ── Modo demo (sin Apps Script configurado) ──────────────────
var _demoPart = [];
var _demoPron = [];

function simularRespuesta(accion, datos, callback) {
  setTimeout(function() {

    if (accion === 'registrar') {
      var existe = _demoPart.some(function(p) { return p.correo === datos.correo; });
      if (existe) { callback({ ok: false, error: 'Ya existe un registro con ese correo electrónico.' }); return; }
      _demoPart.push({ nombre: datos.nombre, correo: datos.correo, telefono: datos.telefono,
                       fecha: fechaAhora(), estado: 'Pendiente' });
      callback({ ok: true, mensaje: 'Registro exitoso (modo demo)' });

    } else if (accion === 'verificarCorreo') {
      var ex = _demoPart.some(function(p) { return p.correo === datos.correo; });
      callback({ ok: true, existe: ex });

    } else if (accion === 'guardarPronosticos') {
      var part = _demoPart.find(function(p) { return p.correo === datos.correo; });
      if (!part) { callback({ ok: false, error: 'Participante no encontrado.' }); return; }
      if (part.estado === 'Enviado') { callback({ ok: false, error: 'Ya enviaste tus pronósticos.' }); return; }
      part.estado = 'Enviado';
      datos.pronosticos.forEach(function(p) {
        _demoPron.push(Object.assign({}, p, { nombre: datos.nombre, correo: datos.correo, fecha: fechaAhora() }));
      });
      callback({ ok: true, mensaje: 'Pronósticos guardados (modo demo)' });

    } else if (accion === 'obtenerParticipantes') {
      var lista = _demoPart;
      if (datos.busqueda) {
        var q = datos.busqueda.toLowerCase();
        lista = lista.filter(function(p) {
          return p.nombre.toLowerCase().includes(q) || p.correo.includes(q) || p.telefono.includes(q);
        });
      }
      callback({ ok: true, datos: lista });

    } else if (accion === 'obtenerPronosticos') {
      var lista2 = _demoPron;
      if (datos.partido) lista2 = lista2.filter(function(p) { return p.partido === datos.partido; });
      callback({ ok: true, datos: lista2 });

    } else if (accion === 'registrarResultado') {
      callback({ ok: true });

    } else if (accion === 'obtenerGanadores') {
      callback({ ok: true, ganadores: _demoPart.map(function(p) { return { nombre: p.nombre, correo: p.correo, total: Math.floor(Math.random()*3) }; }),
                 estadisticas: { totalParticipantes: _demoPart.length } });

    } else {
      callback({ ok: false, error: 'Acción desconocida.' });
    }
  }, 600);
}

function fechaAhora() {
  var d = new Date();
  return d.toLocaleDateString('es-EC') + ' ' + d.toLocaleTimeString('es-EC');
}


// ============================================================
// UTILIDADES
// ============================================================

function irAPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(function(p) {
    p.classList.remove('activa');
    p.style.display = 'none';
  });
  var el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.add('activa');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function mostrarToast(mensaje, tipo) {
  var t = document.getElementById('toast');
  t.textContent = mensaje;
  t.className   = 'toast ' + (tipo || '');
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.display = 'none'; }, 3500);
}

function setBotonCargando(id, cargando) {
  var btn     = document.getElementById(id);
  var texto   = btn.querySelector('.btn-texto');
  var spinner = btn.querySelector('.btn-spinner');
  btn.disabled         = cargando;
  texto.style.display  = cargando ? 'none' : 'inline';
  spinner.style.display = cargando ? 'inline' : 'none';
}

function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function validarTelefono(tel) {
  return /^\+?[\d\s\-]{7,15}$/.test(tel);
}

function abrirModal() {
  document.getElementById('modalPolitica').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modalPolitica').style.display = 'none';
}

function escHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}