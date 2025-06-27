// manage.js - JS logic for Manage App page

function formatOptionWithCheckbox(option) {
  if (!option.id) return option.text;
  return $('<span><input type="checkbox" style="margin-right:6px;" />' + option.text + '</span>');
}

$(document).ready(function () {
  $('.select2-multiple').select2({
    width: '100%',
    closeOnSelect: false,
    templateResult: formatOptionWithCheckbox,
    templateSelection: formatOptionWithCheckbox,
    escapeMarkup: m => m
  });

  // Terminal Server IP Deletion Chain
  $('#ts_region_select').change(function () {
    $.get(`/get-dcs?region=${$(this).val()}&target=ts`, dcs => {
      $('#ts_dc_select').html(dcs.map(dc => `<option value="${dc}">${dc}</option>`)).trigger('change');
    });
  });

  $('#ts_dc_select').change(function () {
    $.get(`/get-buildings?region=${$('#ts_region_select').val()}&dc=${$(this).val()}&target=ts`, blds => {
      $('#ts_building_select').html(blds.map(b => `<option value="${b}">${b}</option>`)).trigger('change');
    });
  });

  $('#ts_building_select').change(function () {
    $.get(`/get-ips?region=${$('#ts_region_select').val()}&dc=${$('#ts_dc_select').val()}&building=${$(this).val()}&target=ts`, ips => {
      $('#ts_ips').html(ips.map(ip => `<option value="${ip}">${ip}</option>`)).trigger('change');
    });
  });

  // Device IP Deletion Chain
  $('#dev_region_select').change(function () {
    $.get(`/get-dcs?region=${$(this).val()}&target=dev`, dcs => {
      $('#dev_dc_select').html(dcs.map(dc => `<option value="${dc}">${dc}</option>`)).trigger('change');
    });
  });

  $('#dev_dc_select').change(function () {
    $.get(`/get-buildings?region=${$('#dev_region_select').val()}&dc=${$(this).val()}&target=dev`, blds => {
      $('#dev_building_select').html(blds.map(b => `<option value="${b}">${b}</option>`)).trigger('change');
    });
  });

  $('#dev_building_select').change(function () {
    $.get(`/get-ips?region=${$('#dev_region_select').val()}&dc=${$('#dev_dc_select').val()}&building=${$(this).val()}&target=dev`, ips => {
      $('#dev_ips').html(ips.map(ip => `<option value="${ip}">${ip}</option>`)).trigger('change');
    });
  });

  $('#select-all-ts').change(function () {
    $('#ts_ips option').prop('selected', this.checked).trigger('change');
  });

  $('#select-all-dev').change(function () {
    $('#dev_ips option').prop('selected', this.checked).trigger('change');
  });

  $('#vendor-select').change(function () {
    $.get(`/get-commands?vendor=${$(this).val()}`, cmds => {
      $('#command-select').html(cmds.map(c => `<option value="${c.id}">${c.command}</option>`)).trigger('change');
    });
  });
});