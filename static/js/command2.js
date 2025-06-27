let commandList = [];
let outputData = window.outputData || {};

function prepareSubmit() {
  const selected = $('#selected_ips').val();
  if (!selected || selected.length === 0) {
    alert("Please select at least one IP.");
    return false;
  }

  $('#selected_ips option').each(function () {
    $(this).prop('selected', selected.includes($(this).val()));
  });

  $('#selected_ips').trigger('change.select2');
  return true;
}

function loadTemplateTitles() {
  fetch("/get-template-titles")
    .then(res => res.json())
    .then(titles => {
      const dropdown = document.getElementById("template_title");
      dropdown.innerHTML = '<option value="" disabled selected>-- Select Vendor --</option>';
      titles.forEach(title => {
        const opt = document.createElement("option");
        opt.value = title;
        opt.textContent = title.charAt(0).toUpperCase() + title.slice(1);
        if (title === window.selectedVendor) opt.selected = true;
        dropdown.appendChild(opt);
      });

      if (window.selectedVendor) fetchCommands();
    });
}

function fetchCommands() {
  const title = document.getElementById("template_title").value;
  const box = document.getElementById("suggestions");
  box.innerHTML = "";
  if (!title) {
    commandList = [];
    return;
  }

  fetch(`/get-commands?vendor=${title}`)
    .then(res => res.json())
    .then(data => {
      commandList = data.map(c => c.command);
    });
}

function suggestCommands() {
  const input = document.getElementById("command").value;
  const box = document.getElementById("suggestions");
  box.innerHTML = "";

  if (!document.getElementById("template_title").value || input.length < 2) return;

  const suggestions = commandList.filter(cmd =>
    cmd.toLowerCase().includes(input.toLowerCase())
  );

  suggestions.forEach(cmd => {
    const div = document.createElement("div");

    // ✅ force entire line green
    div.style.color = "green";

    // ✅ bold only matching part
    div.innerHTML = cmd.replace(
      new RegExp(input, 'gi'),
      match => `<strong>${match}</strong>`
    );

    div.onclick = () => {
      document.getElementById("command").value = cmd;
      box.innerHTML = "";
    };

    box.appendChild(div);
  });
}

function handleDeviceSelection() {
  const selectedIp = document.getElementById("ip_select")?.value;
  const outputArea = document.getElementById("output_area");

  if (selectedIp && outputData[selectedIp]) {
    outputArea.textContent = outputData[selectedIp];
  } else {
    outputArea.textContent = "No output available.";
  }
}

function loadMultiIpDropdown() {
  const $dropdown = $('#selected_ips');
  $dropdown.html('');

  if (window.multiIps && Array.isArray(window.multiIps)) {
    window.multiIps.forEach(ip => {
      const isSelected = window.selectedIps.includes(ip);
      const opt = new Option(ip, ip, false, isSelected);
      $dropdown.append(opt);
    });
  }

  $dropdown.select2({
    placeholder: "-- Select IPs --",
    allowClear: true,
    closeOnSelect: false,
    width: 'resolve'
  });

  $('#select-all-btn').click(() => {
    $('#selected_ips > option').prop("selected", true);
    $dropdown.trigger("change");
  });
}

window.onload = function () {
  loadTemplateTitles();
  loadMultiIpDropdown();

  if (outputData && Object.keys(outputData).length > 0) {
    const ipSelect = document.getElementById("ip_select");
    Object.keys(outputData).forEach(ip => {
      const opt = document.createElement("option");
      opt.value = ip;
      opt.textContent = ip;
      ipSelect?.appendChild(opt);
    });
    ipSelect?.addEventListener("change", handleDeviceSelection);
    ipSelect?.dispatchEvent(new Event("change"));
  }
};