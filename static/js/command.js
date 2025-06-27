let commandList = [];
let outputData = window.outputData || {};

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
    div.textContent = cmd;
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

  const allIps = ["__select_all__", ...(window.multiIps || [])];

  allIps.forEach(ip => {
    const label = ip === "__select_all__" ? "Select All" : ip;
    const isSelected = window.selectedIps.includes(ip);
    const opt = new Option(label, ip, false, isSelected);
    $dropdown.append(opt);
  });

  $dropdown.select2({
    placeholder: "-- Select IPs --",
    closeOnSelect: false,
    width: 'resolve',
    templateResult: function (data) {
      if (!data.id) return data.text;
      const selectedValues = $('#selected_ips').val() || [];
      const isSelected = selectedValues.includes(data.id);
      const checkbox = `<input type="checkbox" style="margin-right: 5px;" ${isSelected ? "checked" : ""}>`;
      const label = data.id === "__select_all__" ? "<b>Select All</b>" : data.text;
      return $(`<span>${checkbox}${label}</span>`);
    },
    templateSelection: function (data) {
      return data.id === "__select_all__" ? null : data.text;
    },
    escapeMarkup: markup => markup
  });

  $dropdown.on("select2:select", function (e) {
    const val = e.params.data.id;
    const allExceptSelectAll = allIps.filter(ip => ip !== "__select_all__");

    if (val === "__select_all__") {
      $dropdown.val(["__select_all__", ...allExceptSelectAll]).trigger("change.select2");
    } else {
      const current = $dropdown.val() || [];
      if (current.length === allExceptSelectAll.length) {
        $dropdown.val(["__select_all__", ...current]).trigger("change.select2");
      }
    }

    $dropdown.select2('close');
    setTimeout(() => $dropdown.select2('open'), 0);
  });

  $dropdown.on("select2:unselect", function (e) {
    const val = e.params.data.id;
    if (val === "__select_all__") {
      $dropdown.val(null).trigger("change.select2");
    } else {
      const current = $dropdown.val() || [];
      if (current.includes("__select_all__")) {
        $dropdown.val(current.filter(v => v !== "__select_all__")).trigger("change.select2");
      }
    }

    $dropdown.select2('close');
    setTimeout(() => $dropdown.select2('open'), 0);
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

  document.getElementById("commandForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const selected = $('#selected_ips').val();
    if (!selected || selected.length === 0) {
      alert("Please select at least one IP.");
      return;
    }

    document.body.classList.add("loading");
    document.getElementById("loading-overlay").style.display = "flex";

    const formData = new FormData(this);

    fetch('/run-command', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        document.body.classList.remove("loading");
        document.getElementById("loading-overlay").style.display = "none";

        const outputBox = document.getElementById("output_area");
        const selector = document.getElementById("ip_select");

        outputBox.innerHTML = "";
        selector.innerHTML = "";

        const outputData = data.output_data;

        Object.entries(outputData).forEach(([ip, output]) => {
          const opt = document.createElement("option");
          opt.value = ip;
          opt.textContent = ip;
          selector.appendChild(opt);
        });

        selector.onchange = () => {
          const ip = selector.value;
          outputBox.textContent = outputData[ip] || "No output.";
        };

        selector.dispatchEvent(new Event("change"));
      })
      .catch(error => {
        document.body.classList.remove("loading");
        document.getElementById("loading-overlay").style.display = "none";
        console.error(error);
        alert("Something went wrong while running the command.");
      });
  });
};