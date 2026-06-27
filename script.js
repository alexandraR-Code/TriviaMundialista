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
// NOTA: el partido "ecu_vs_civ" ya se jugó y su pronóstico fue registrado.
// Por eso tiene "bloqueado: true" y un "marcador" fijo con el valor guardado.
// Para los próximos partidos que se jueguen, simplemente copia este mismo
// patrón: agrega bloqueado:true y marcador:{local: X, visitante: Y} con el
// resultado que corresponda.
var PARTIDOS = [
  {
    id: 'ecu_vs_civ', local: 'Ecuador', visitante: 'Costa de Marfil',
    bandLocal: '🇪🇨', bandVisita: '🇨🇮',
    fecha: '2026-06-14T18:00:00-05:00',
    bloqueado: true,
    marcador: { local: 0, visitante: 1 }
  },
  {
    id: 'ecu_vs_cur', local: 'Ecuador', visitante: 'Curazao',
    bandLocal: '🇪🇨', bandVisita: '🇨🇼',
    fecha: '2026-06-20T19:00:00-05:00',
    bloqueado: true,
    marcador: { local: 0, visitante: 0 }
  },
  {
    id: 'ecu_vs_ger', local: 'Ecuador', visitante: 'Alemania',
    bandLocal: '🇪🇨', bandVisita: '🇩🇪',
    fecha: '2026-06-25T15:00:00-05:00',
    bloqueado: true,
    marcador: { local: 2, visitante: 1 }
  },
  {
    id: 'ecu_vs_tbd', local: 'Ecuador', visitante: 'Por Definir',
    bandLocal: '🇪🇨', bandVisita: '🏳️',
    fecha: null,
    bloqueado: false
  }
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
  cargarEstadoLocal();
  construirPartidos();
  inicializarEventos();
  poblarSelectoresAdmin();
  // Siempre inicia en pantalla de registro — el usuario puede ver sus pronósticos
  // ingresando su correo con el link "¿Ya te registraste?"
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

// Lee lo que guardó guardarEstadoLocal() y lo vuelve a poner en "estado".
// Sin esto, cada vez que se recarga la página "estado.participante" se
// queda en null aunque el usuario ya se hubiera registrado antes, y por
// eso el botón "Ver mis pronósticos" no hacía nada al hacer clic.
function cargarEstadoLocal() {
  try {
    var guardado = localStorage.getItem(LS_KEY);
    if (!guardado) return;
    var datos = JSON.parse(guardado);
    if (datos && datos.participante) {
      estado.participante = datos.participante;
      estado.yaEnvio      = !!datos.yaEnvio;
      var chip = document.getElementById('chipNombre');
      if (chip) chip.textContent = '👤 ' + datos.participante.nombre.split(' ')[0];
    }
  } catch (e) { /* almacenamiento no disponible o datos corruptos */ }
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

    if (p.bloqueado) {
      // ── Partido ya jugado / pronóstico ya registrado ──────────
      // No se muestran <input>: se reemplazan por texto fijo
      // (marcador-display) para que no pueda editarse, y se agrega
      // una etiqueta "Ya registrado" para que quede claro al usuario.
      card.classList.add('partido-bloqueado');
      card.innerHTML =
        '<div class="partido-equipos">' +
          '<div class="equipo-nombre">' + p.bandLocal + ' ' + p.local + '</div>' +
          '<div class="partido-vs">VS</div>' +
          '<div class="equipo-nombre derecha">' + p.visitante + ' ' + p.bandVisita + '</div>' +
        '</div>' +
        '<div class="partido-marcador" style="pointer-events:none;">' +
          '<div class="marcador-display">' + p.marcador.local + ' — ' + p.marcador.visitante + '</div>' +
        '</div>' +
        '<div class="etiqueta-bloqueado">🔒 Bloqueado </div>';
    } else {
      // ── Partido editable normal ───────────────────────────────
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
        '</div>';
    }

    lista.appendChild(card);
  });
}

function poblarSelectoresAdmin() {
  var selPartido    = document.getElementById('filtroPartido');
  var selResPartido = document.getElementById('resPartido');
  var selAciertos   = document.getElementById('filtroAciertos');

  PARTIDOS.forEach(function(p) {
    var etiqueta = p.local + ' vs ' + p.visitante;
    [selPartido, selResPartido, selAciertos].forEach(function(sel) {
      if (!sel) return;
      var opt = document.createElement('option');
      opt.value       = etiqueta;
      opt.textContent = etiqueta;
      sel.appendChild(opt);
    });
  });

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
  // Pequeño ayudante: solo agrega el evento si el elemento existe.
  // Antes, si CUALQUIER id de esta función no existía en el HTML
  // (por ejemplo "linkYaRegistrado"), todo el addEventListener()
  // siguiente lanzaba un error y JavaScript dejaba de ejecutar el
  // resto de esta función. Eso significaba que botones definidos
  // MÁS ABAJO en este mismo bloque (como "Ver mis pronósticos")
  // nunca llegaban a recibir su evento de clic.
  function on(id, evento, handler) {
    var el = document.getElementById(id);
    if (!el) {
      console.warn('[inicializarEventos] No existe el elemento con id="' + id + '". Revisa que index.html lo tenga.');
      return;
    }
    el.addEventListener(evento, handler);
  }

  // Habilitar botón REGISTRARME cuando acepta política
  on('chkPolitica', 'change', function() {
    document.getElementById('btnRegistrar').disabled = !this.checked;
  });

  // Habilitar botón ENVIAR cuando acepta política
  on('chkPoliticaPron', 'change', function() {
    document.getElementById('btnEnviarPron').disabled = !this.checked;
  });

  // Botón registrar
  on('btnRegistrar', 'click', registrarParticipante);

  // Botón enviar pronósticos → muestra confirmación antes
  on('btnEnviarPron', 'click', mostrarConfirmacionEnvio);

  // Modal política
  on('linkPolitica', 'click', function(e) { e.preventDefault(); abrirModal(); });
  on('linkPolitica2', 'click', function(e) { e.preventDefault(); abrirModal(); });

  // Ya registrado
  on('linkYaRegistrado', 'click', function(e) {
    e.preventDefault();
    document.getElementById('modalYaRegistrado').style.display = 'flex';
  });

  // Ver mis pronósticos desde pantalla de confirmación
  on('btnVerMisPron', 'click', function() {
    if (estado.participante) {
      cargarMisPronosticos(estado.participante.correo, estado.participante.nombre);
    } else {
      // Antes esto no hacía nada visible cuando no había participante
      // en memoria (por ejemplo tras recargar la página). Ahora avisa
      // al usuario y lo manda a identificarse con su correo.
      mostrarToast('No encontramos tu sesión. Ingresa tu correo para ver tus pronósticos.', 'error');
      document.getElementById('modalYaRegistrado').style.display = 'flex';
    }
  });

  // Actualizar etiqueta de resultados admin al cambiar partido
  on('resPartido', 'change', function() {
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

    // ── Partido bloqueado: usamos directamente su marcador guardado.
    // No leemos el DOM (no existen inputs para este partido) y no
    // exigimos nada al usuario: simplemente se incluye en el envío
    // con el resultado que ya estaba registrado.
    if (p.bloqueado) {
      var gL = p.marcador.local;
      var gV = p.marcador.visitante;
      var resultadoFijo = gL > gV ? 'Local' : gL < gV ? 'Visitante' : 'Empate';
      pronosticos.push({
        partido:         p.local + ' vs ' + p.visitante,
        equipoLocal:     p.local,
        equipoVisitante: p.visitante,
        golesLocal:      gL,
        golesVisitante:  gV,
        resultado:       resultadoFijo
      });
      return; // saltar a siguiente partido del forEach
    }

    // ── Partido editable normal: se valida como antes ───────────
    var golLocal  = document.getElementById('gol_' + p.id + '_local').value;
    var golVisita = document.getElementById('gol_' + p.id + '_visita').value;

    if (golLocal === '' || golVisita === '') {
      valido = false;
      mensajeErr = 'Completa el marcador para: ' + p.local + ' vs ' + p.visitante;
    } else {
      var gL2 = parseInt(golLocal);
      var gV2 = parseInt(golVisita);
      var resultado = gL2 > gV2 ? 'Local' : gL2 < gV2 ? 'Visitante' : 'Empate';
      pronosticos.push({
        partido:         p.local + ' vs ' + p.visitante,
        equipoLocal:     p.local,
        equipoVisitante: p.visitante,
        golesLocal:      gL2,
        golesVisitante:  gV2,
        resultado:       resultado
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
      llamarAPI('obtenerParticipantes', { busqueda: correo }, function(resp2) {
        var part = resp2.datos && resp2.datos.find(function(p) { return p.correo === correo; });
        if (part) {
          estado.participante = { nombre: part.nombre, correo: part.correo, telefono: part.telefono };
          estado.yaEnvio      = part.estado === 'Enviado';
          cerrarModalYaRegistrado();

          if (estado.yaEnvio) {
            // Ya envió — mostrar sus pronósticos
            mostrarToast('¡Hola ' + part.nombre.split(' ')[0] + '! Aquí están tus pronósticos.', 'exito');
            cargarMisPronosticos(correo, part.nombre);
          } else {
            // Registrado pero no envió — puede completar pronósticos
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

function cargarMisPronosticos(correo, nombre) {
  var cont = document.getElementById('misPronContenido');
  cont.innerHTML = '<div class="cargando"><span class="dot-spin"></span> Cargando tus pronósticos...</div>';
  irAPantalla('pantallaMisPronosticos');

  llamarAPI('obtenerPronosticos', { correo: correo }, function(resp) {

    // Antes, si la petición fallaba (CORS, sin internet, Apps Script
    // caído, etc.) este código igual seguía de largo como si "datos"
    // fuera una lista vacía, y mostraba "No se encontraron pronósticos"
    // aunque el verdadero problema era que la conexión falló. Por eso
    // parecía que el botón "no hacía nada": cambiaba de pantalla pero
    // el mensaje no explicaba el error real.
    if (!resp || resp.ok === false) {
      cont.innerHTML =
        '<p class="sin-datos" style="text-align:center; padding: 32px 0;">' +
        '⚠️ No se pudo conectar con el servidor para obtener tus pronósticos.<br/>' +
        (resp && resp.error ? escHTML(resp.error) : 'Error de conexión.') +
        '<br/><br/>Verifica tu conexión a internet e inténtalo de nuevo.</p>';
      return;
    }

    var lista = (resp.datos || []).filter(function(p) { return p.correo === correo; });

    if (!lista.length) {
      cont.innerHTML = '<p class="sin-datos" style="text-align:center; padding: 32px 0;">No se encontraron pronósticos para este correo.</p>';
      return;
    }

    var partidos   = lista.filter(function(p) { return p.partido !== 'Final' && p.partido !== 'Campeón'; });
    var final      = lista.find(function(p) { return p.partido === 'Final'; });
    var campeonReg = lista.find(function(p) { return p.partido === 'Campeón'; });

    var html = '<div style="background:var(--azul-medio);border-radius:12px;padding:16px 20px;margin-bottom:20px;">' +
      '<p style="color:var(--dorado);font-weight:700;font-size:15px;margin:0 0 4px;">👤 ' + escHTML(nombre) + '</p>' +
      '<p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">' + escHTML(correo) + '</p>' +
    '</div>';

    // Partidos Ecuador
    if (partidos.length) {
      html += '<div class="seccion-encabezado" style="margin-bottom:12px;">' +
        '<span class="seccion-icono">🇪🇨</span>' +
        '<span class="seccion-tit">PARTIDOS DE ECUADOR</span>' +
      '</div>';
      partidos.forEach(function(p) {
        var marcador = p.golesLocal + ' — ' + p.golesVisitante;
        var resTexto = p.resultado === 'Local'     ? '✅ Gana ' + escHTML(p.equipoLocal || p.local) :
                       p.resultado === 'Visitante' ? '✅ Gana ' + escHTML(p.equipoVisitante || p.visitante) :
                                                     '🤝 Empate';
        html += '<div class="partido-card" style="margin-bottom:12px;">' +
          '<div class="partido-equipos">' +
            '<div class="equipo-nombre">' + escHTML(p.equipoLocal || p.local || '') + '</div>' +
            '<div class="partido-vs">VS</div>' +
            '<div class="equipo-nombre derecha">' + escHTML(p.equipoVisitante || p.visitante || '') + '</div>' +
          '</div>' +
          '<div class="partido-marcador" style="pointer-events:none;">' +
            '<div class="marcador-display">' + marcador + '</div>' +
          '</div>' +
          '<div style="text-align:center;padding:8px 0;font-size:13px;color:var(--dorado);">' + resTexto + '</div>' +
        '</div>';
      });
    }

    // Final
    if (final) {
      html += '<div class="seccion-encabezado" style="margin:20px 0 12px;">' +
        '<span class="seccion-tit">LOS DOS EQUIPOS FINALISTAS</span>' +
      '</div>' +
      '<div class="finalistas-grid" style="background:var(--azul-medio);border-radius:12px;padding:16px;margin-bottom:16px;">' +
        '<div class="finalista-box"><div style="color:var(--dorado);font-size:13px;font-weight:700;margin-bottom:6px;">FINALISTA 1</div>' +
          '<div style="color:#fff;font-weight:600;">' + escHTML(final.equipoLocal || final.local || '') + '</div></div>' +
        '<div class="finalistas-vs">VS</div>' +
        '<div class="finalista-box"><div style="color:var(--dorado);font-size:13px;font-weight:700;margin-bottom:6px;">FINALISTA 2</div>' +
          '<div style="color:#fff;font-weight:600;">' + escHTML(final.equipoVisitante || final.visitante || '') + '</div></div>' +
      '</div>';
    }

    // Campeón
    if (campeonReg) {
      var campNombre = campeonReg.equipoLocal || campeonReg.local || campeonReg.resultado || '';
      html += '<div class="seccion-pronosticos campeon-seccion" style="margin-bottom:16px;">' +
        '<div class="seccion-encabezado" style="margin-bottom:10px;">' +
          '<span class="seccion-icono"></span>' +
          '<span class="seccion-tit">EQUIPO CAMPEÓN</span>' +
        '</div>' +
        '<div class="campeon-estrellas">★ ★ ★ ★ ★</div>' +
        '<div style="text-align:center;font-size:20px;font-weight:700;color:#fff;padding:12px 0;">' +
          escHTML(campNombre) +
        '</div>' +
      '</div>';
    }

    cont.innerHTML = html;
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

  var mapa = { participantes: 0, pronosticos: 1, resultados: 2, ganadores: 3, aciertos: 4 };
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


// ── Aciertos por Partido ────────────────────────────────────

function parseFechaLocal(fechaStr) {
  if (!fechaStr) return null;
  var s = String(fechaStr);
  var partes = s.split(' ');
  if (partes.length < 2) return null;
  var d = partes[0].split('/');
  var t = partes[1].split(':');
  if (d.length < 3) return null;
  return new Date(parseInt(d[2]), parseInt(d[1]) - 1, parseInt(d[0]),
                  parseInt(t[0] || 0), parseInt(t[1] || 0), parseInt(t[2] || 0));
}

function cargarAciertos() {
  var partidoNombre = document.getElementById('filtroAciertos').value;
  if (!partidoNombre) {
    mostrarToast('Selecciona un partido.', 'error');
    return;
  }

  var partido = PARTIDOS.find(function(p) {
    return (p.local + ' vs ' + p.visitante) === partidoNombre;
  });

  if (!partido || !partido.bloqueado || !partido.marcador) {
    document.getElementById('bodyAciertos').innerHTML =
      '<tr><td colspan="6" class="sin-datos">Este partido aún no tiene resultado oficial.</td></tr>';
    return;
  }

  var tbody = document.getElementById('bodyAciertos');
  tbody.innerHTML = '<tr><td colspan="6" class="sin-datos"><span class="dot-spin"></span> Cargando...</td></tr>';

  var fechaLimite = partido.fecha ? new Date(partido.fecha) : null;
  var resLocal  = partido.marcador.local;
  var resVisita = partido.marcador.visitante;

  llamarAPI('obtenerPronosticos', { partido: partidoNombre }, function(resp) {
    if (!resp.ok) {
      tbody.innerHTML = '<tr><td colspan="6" class="sin-datos">Error al cargar datos.</td></tr>';
      return;
    }

    var lista = resp.datos || [];
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="sin-datos">No hay pronósticos para este partido.</td></tr>';
      return;
    }

    tbody.innerHTML = lista.map(function(p) {
      var gL = parseInt(p.golesLocal);
      var gV = parseInt(p.golesVisitante);
      var acerto = (gL === resLocal && gV === resVisita);

      var aTiempo = true;
      if (fechaLimite && p.fecha) {
        var fechaEnvio = parseFechaLocal(p.fecha);
        if (fechaEnvio) aTiempo = fechaEnvio < fechaLimite;
      }

      var valido = acerto && aTiempo;

      return '<tr>' +
        '<td>' + escHTML(p.nombre) + '<br/><small style="color:rgba(255,255,255,0.4)">' + escHTML(p.correo) + '</small></td>' +
        '<td style="text-align:center">' + gL + ' - ' + gV + '</td>' +
        '<td style="text-align:center">' + resLocal + ' - ' + resVisita + '</td>' +
        '<td style="text-align:center">' + (acerto ? '✅' : '❌') + '</td>' +
        '<td style="text-align:center">' + (aTiempo ? '✅' : '⛔') + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + (valido ? 'var(--dorado)' : '#ff4444') + '">' +
          (valido ? '✅ Válido' : '❌ No válido') +
        '</td>' +
      '</tr>';
    }).join('');
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
      if (datos.correo)  lista2 = lista2.filter(function(p) { return p.correo === datos.correo; });
      callback({ ok: true, datos: lista2 });

    } else if (accion === 'registrarResultado') {
      callback({ ok: true });

    } else if (accion === 'obtenerGanadores') {
      callback({ ok: true, ganadores: _demoPart.map(function(p) { return { nombre: p.nombre, correo: p.correo, total: Math.floor(Math.random()*3) }; }),
                 estadisticas: { totalParticipantes: _demoPart.length } });

    } else if (accion === 'obtenerAciertosDetalle') {
      callback({ ok: true, aciertos: [] });

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