function loadDropdown(targetPrefix, type) {
  $(`#${targetPrefix}_region`).change(function () {
    const region = $(this).val();
    const dcDropdown = $(`#${targetPrefix}_dc`);
    const buildingDropdown = $(`#${targetPrefix}_building`);
    const ipDropdown = (targetPrefix.includes("multi") && type === "dev")
  ? $(`#${targetPrefix}_dev_ip`)
  : $(`#${targetPrefix}_ip`);

    dcDropdown.html('<option value="">-- Select DC --</option>');
    buildingDropdown.html('<option value="">-- Select Building --</option>');
    ipDropdown.html('<option value="">-- Select IP --</option>');

    if (!region) return;

    if (region === "All") {
      $.get(`/get-ips?region=All&dc=All&building=All&target=${type}`, function (ips) {
        const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
        ipDropdown.html('');
        uniqueIps.forEach(ip => ipDropdown.append(new Option(ip, ip)));
        ipDropdown.append(new Option("Select All", "select_all"));  // 👈 Add this
        ipDropdown.val(null).trigger('change'); // Reset selection
      });
      return;
    }

    $.get(`/get-dcs?region=${region}&target=${type}`, function (dcs) {
      dcs.forEach(dc => dcDropdown.append(new Option(dc, dc)));
    });
  });

  $(`#${targetPrefix}_dc`).change(function () {
    const region = $(`#${targetPrefix}_region`).val();
    const dc = $(this).val();
    const buildingDropdown = $(`#${targetPrefix}_building`);
    const ipDropdown = (targetPrefix.includes("multi") && type === "dev")
  ? $(`#${targetPrefix}_dev_ip`)
  : $(`#${targetPrefix}_ip`);

    buildingDropdown.html('<option value="">-- Select Building --</option>');
    ipDropdown.html('<option value="">-- Select IP --</option>');

    if (!dc) return;

    if (dc === "All") {
      $.get(`/get-ips?region=${region}&dc=All&building=All&target=${type}`, function (ips) {
        const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
        ipDropdown.html('');
        uniqueIps.forEach(ip => ipDropdown.append(new Option(ip, ip)));
        ipDropdown.append(new Option("Select All", "select_all"));  // 👈 Add this
        ipDropdown.val(null).trigger('change'); // Reset selection
      });
      return;
    }

    $.get(`/get-buildings?region=${region}&dc=${dc}&target=${type}`, function (blds) {
      blds.forEach(b => buildingDropdown.append(new Option(b, b)));
    });
  });

  $(`#${targetPrefix}_building`).change(function () {
    const region = $(`#${targetPrefix}_region`).val();
    const dc = $(`#${targetPrefix}_dc`).val();
    const building = $(this).val();
    const ipDropdown = (targetPrefix.includes("multi") && type === "dev")
  ? $(`#${targetPrefix}_dev_ip`)
  : $(`#${targetPrefix}_ip`);
    if (targetPrefix.startsWith("single")) {
      ipDropdown.html('<option value="">-- Select IP --</option>');
    } else {
      ipDropdown.html('');
    }

    if (!building) return;

    $.get(`/get-ips?region=${region}&dc=${dc}&building=${building}&target=${type}`, function (ips) {
      const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];

      // ✅ Insert Select All first
      ipDropdown.append(new Option("Select All", "select_all"));

      // Then append actual IPs
      uniqueIps.forEach(ip => ipDropdown.append(new Option(ip, ip)));

      ipDropdown.val(null).trigger('change');
    });
  });

}

$(document).ready(function () {
  $('.select2').not('#multi_ts_dev_ip, #multi_ts_ip, #multi_dev_ip').select2({ width: '100%' });

  function formatCheckboxOption(option) {
    if (!option.id) return option.text;

    const $option = $(`
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${option.text}</span>
        <input type="checkbox" class="custom-check" style="margin-left: 10px;" />
      </div>
    `);

    setTimeout(() => {
      const $select = $('#' + option.element.parentElement.id);
      const selectedValues = $select.val() || [];

      if (option.id === 'select_all') {
        const allOptions = $select.find('option:not([disabled]):not([value="select_all"])')
          .map(function () { return this.value; }).get();

        const allSelected = allOptions.length > 0 && allOptions.every(val => selectedValues.includes(val));
        $option.find('.custom-check').prop('checked', allSelected);
      } else {
        $option.find('.custom-check').prop('checked', selectedValues.includes(option.id));
      }
    }, 0);

    return $option;
  }

  function formatCheckboxSelection(option) {
    return option.text;
  }

  function handleSelectAll(id) {
    const dropdown = $(`#${id}`);
    const values = dropdown.find('option:not([disabled]):not([value="select_all"])').map(function () {
      return this.value;
    }).get();
    dropdown.val(values).trigger('change');
  }

  $('#multi_ts_dev_ip, #multi_dev_ip').each(function () {
    const $select = $(this);
    if (!$select.find('option[value="select_all"]').length) {
      $select.prepend(new Option("Select All", "select_all"));
    }

    $select.select2({
      width: '100%',
      closeOnSelect: false,
      templateResult: formatCheckboxOption,
      templateSelection: formatCheckboxSelection
    }).on('select2:select', function (e) {
      const selectedId = e.params.data.id;
      const allOptions = $(this).find('option:not([disabled]):not([value="select_all"])').map(function () {
        return this.value;
      }).get();

      if (selectedId === 'select_all') {
        const currentlySelected = $(this).val() || [];
        const allSelected = allOptions.every(val => currentlySelected.includes(val));

        if (allSelected) {
          $(this).val(null).trigger('change');
        } else {
          $(this).val(allOptions).trigger('change');
        }
      }

      $(this).select2('close').select2('open');
    }).on('select2:unselect', function (e) {
      const unselectedId = e.params.data.id;

      // If "Select All" was unselected, deselect everything
      if (unselectedId === 'select_all') {
        $(this).val(null).trigger('change');
      }

      $(this).select2('close').select2('open');
    });

  });


  $('#multi_ts_ip').select2({ width: '100%' });

  $('#mode').on('change', function () {
    const mode = $(this).val();
    $('#mode-section').show();
    $('#single-device-section').toggle(mode === 'single');
    $('#multi-device-section').toggle(mode === 'multi');
  });

  loadDropdown("single_ts", "ts");
  loadDropdown("single_dev", "dev");
  loadDropdown("multi_ts", "ts");
  loadDropdown("multi_dev", "dev");

  $('#single_dev_region').change(function () {
    const val = $(this).val();
    const devIpDropdown = $('#single_dev_ip');
    $('#single_dev_dc, #single_dev_building').html('<option value="">-- Select --</option>');
    devIpDropdown.html('<option value="">-- Select IP --</option>');

    if (val === "All") {
      $.get(`/get-ips?region=All&dc=All&building=All&target=dev`, function (ips) {
        const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
        devIpDropdown.html('<option value="">-- Select IP --</option>');
        uniqueIps.forEach(ip => devIpDropdown.append(new Option(ip, ip)));
      });
    }
  });

  $('#single_ts_region').change(function () {
    const val = $(this).val();
    const devIpDropdown = $('#single_ts_dev_ip');
    $('#single_ts_dc, #single_ts_building').html('<option value="">-- Select --</option>');
    devIpDropdown.html('<option value="">-- Select IP --</option>');
    $('#single_ts_ip').html('<option value="">-- Select --</option>');

    if (val === "All") {
      $.get(`/get-ips?region=All&dc=All&building=All&target=dev`, function (ips) {
        const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
        devIpDropdown.html('<option value="">-- Select IP --</option>');
        uniqueIps.forEach(ip => devIpDropdown.append(new Option(ip, ip)));
      });
    }
  });

  $('#multi_ts_region').change(function () {
    const val = $(this).val();
    const devIpDropdown = $('#multi_ts_dev_ip');
    $('#multi_ts_dc, #multi_ts_building').html('<option value="">-- Select --</option>');
    devIpDropdown.html('');
    $('#multi_ts_ip').html('<option value="">-- Select --</option>');

    if (val === "All") {
      $.get(`/get-ips?region=All&dc=All&building=All&target=dev`, function (ips) {
        const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
        devIpDropdown.append(new Option("Select All", "select_all"));  // <-- insert here
        uniqueIps.forEach(ip => devIpDropdown.append(new Option(ip, ip)));
      });
    }
  });

  $('#multi_dev_region').change(function () {
    const val = $(this).val();
    const devIpDropdown = $('#multi_dev_ip');

    // Clear previous options cleanly
    $('#multi_dev_dc, #multi_dev_building').html('<option value="">-- Select --</option>');
    devIpDropdown.html('');  // 🔥 Important: clear all existing options

    if (val === "All") {
      $.get(`/get-ips?region=All&dc=All&building=All&target=dev`, function (ips) {
        const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];

        // Clear again just in case before appending
        devIpDropdown.html('');  

        // Only append Select All once
        if (!devIpDropdown.find('option[value="select_all"]').length) {
          devIpDropdown.append(new Option("Select All", "select_all"));
        }

        // Append all unique IPs
        uniqueIps.forEach(ip => devIpDropdown.append(new Option(ip, ip)));

        devIpDropdown.val(null).trigger('change');  // Reset selection
      });
    }
  });

  $('#single_ts_building').change(function () {
    const region = $('#single_ts_region').val();
    const dc = $('#single_ts_dc').val();
    const building = $(this).val();
    const devIpDropdown = $('#single_ts_dev_ip');
    const tsIpDropdown = $('#single_ts_ip');
    devIpDropdown.html('<option value="">-- Select IP --</option>');
    tsIpDropdown.html('<option value="">-- Select --</option>');

    if (!building) return;

    $.get(`/get-ips?region=${region}&dc=${dc}&building=${building}&target=dev`, function (ips) {
      const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
      devIpDropdown.append(new Option("Select All", "select_all"));  // <-- insert here
      uniqueIps.forEach(ip => devIpDropdown.append(new Option(ip, ip)));
    });

    $.get(`/get-ips?region=${region}&dc=${dc}&building=${building}&target=ts`, function (ips) {
      const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
      tsIpDropdown.html('<option value="">-- Select --</option>');
      uniqueIps.forEach(ip => tsIpDropdown.append(new Option(ip, ip)));
    });
  });

  $('#multi_ts_building').change(function () {
    const region = $('#multi_ts_region').val();
    const dc = $('#multi_ts_dc').val();
    const building = $(this).val();
    const devIpDropdown = $('#multi_ts_dev_ip');
    const tsIpDropdown = $('#multi_ts_ip');
    devIpDropdown.html('');
    tsIpDropdown.html('<option value="">-- Select --</option>');

    if (!building) return;

    $.get(`/get-ips?region=${region}&dc=${dc}&building=${building}&target=dev`, function (ips) {
      const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
      devIpDropdown.append(new Option("Select All", "select_all"));  // ✅ FIXED
      uniqueIps.forEach(ip => devIpDropdown.append(new Option(ip, ip)));
    });

    $.get(`/get-ips?region=${region}&dc=${dc}&building=${building}&target=ts`, function (ips) {
      const uniqueIps = [...new Set(ips.map(ip => ip.trim()))];
      tsIpDropdown.html('<option value="">-- Select --</option>');
      uniqueIps.forEach(ip => tsIpDropdown.append(new Option(ip, ip)));
    });
  });
});