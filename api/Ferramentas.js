/* Ferramentas para rodar à mão no editor do Apps Script (não ficam acessíveis pela web).
 * criarPlanilhaDeTeste(): cria uma planilha nova com a aba "Alunos" e 6 alunos FICTÍCIOS. */

var CABECALHOS_ALUNOS = [
  'Nome completo', 'Nome de capoeira', 'Data de nascimento', 'WhatsApp', 'E-mail', 'Turma', 'Horário',
  'Professor responsável', 'Graduação atual', 'Data de entrada', 'Situação', 'Responsável legal (menores)',
  'WhatsApp do responsável', 'Última atualização', 'Contato de emergência — nome',
  'Contato de emergência — parentesco', 'Contato de emergência — WhatsApp', 'ID do envio do site',
  'Origem do cadastro', 'Tipo de envio do site', 'Ano de início', 'Aviso de matrícula'
];

function dadosPlanilhaTeste() {
  var base = [
    // nome, nascimento, whatsapp, turma, professor, responsável, whats resp., emerg. nome, parentesco, whats emerg.
    ['Adulto Teste Um', '1990-03-10', '(43) 90000-0001', 'Projeto Usina Cultural', 'Contramestre Pouca Telha', '', '', 'Contato Teste A', 'Irmã', '(43) 90000-0101'],
    ['Adulta Teste Dois', new Date('1988-07-21T03:00:00Z'), '(43) 90000-0002', 'Academia Pura Vida', 'Contramestre Pouca Telha', '', '', 'Contato Teste B', 'Marido', '(43) 90000-0102'],
    ['Criança Teste Três', '2016-05-05', '', 'Escola de Circo', 'Hallwan Santos', 'Responsável Teste C', '(43) 90000-0203', 'Contato Teste C', 'Avó', '(43) 90000-0103'],
    ['Jovem Teste Quatro', '2012-09-30', '', '2D Centro Aquático e Treinamento Funcional', 'Hallwan Santos', 'Responsável Teste D', '(43) 90000-0204', 'Contato Teste D', 'Mãe', '(43) 90000-0104'],
    ['Adulto Teste Cinco', '1979-01-15', '(43) 90000-0005', 'Escola de Circo', 'Dani Pinguin', '', '', 'Contato Teste E', 'Esposa', '(43) 90000-0105'],
    ['Incompleto Teste Seis', '1995-12-01', '(43) 90000-0006', 'Projeto Usina Cultural', 'Dani Pinguin', '', '', '', '', '']
  ];
  var mapa = mapearCabecalhos(CABECALHOS_ALUNOS);
  var campos = ['nome', 'nascimento', 'whatsapp', 'turma', 'professor', 'responsavel',
    'whatsappResponsavel', 'emergenciaNome', 'emergenciaParentesco', 'emergenciaWhatsapp'];
  var linhas = base.map(function (valores) {
    var linha = CABECALHOS_ALUNOS.map(function () { return ''; });
    campos.forEach(function (c, i) { linha[mapa[c]] = valores[i]; });
    linha[mapa.origem] = 'Site';
    linha[mapa.situacao] = 'Atualização para conferir';
    return linha;
  });
  return { cabecalhos: CABECALHOS_ALUNOS, linhas: linhas };
}

function criarPlanilhaDeTeste() {
  var dados = dadosPlanilhaTeste();
  var planilha = SpreadsheetApp.create('TESTE — Agenda Senzala (dados fictícios)');
  var aba = planilha.getSheets()[0].setName('Alunos');
  aba.getRange(1, 1, 1, dados.cabecalhos.length).setValues([dados.cabecalhos]);
  aba.getRange(2, 1, dados.linhas.length, dados.cabecalhos.length).setValues(dados.linhas);
  console.log('Planilha de teste criada. ID: ' + planilha.getId() + ' — ' + planilha.getUrl());
}

if (typeof module !== 'undefined') {
  module.exports = { dadosPlanilhaTeste: dadosPlanilhaTeste };
}
