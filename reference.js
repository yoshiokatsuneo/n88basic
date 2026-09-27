// Generated from src/*.ts. Do not edit directly.
"use strict";
(() => {
  // src/reference.ts
  var search = document.getElementById("search");
  var category = document.getElementById("category");
  var cards = Array.from(document.querySelectorAll("article"));
  var links = Array.from(document.querySelectorAll("nav a"));
  function filter() {
    const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach((card, i) => {
      const visible = (!category.value || card.dataset.group === category.value) && words.every(
        (w) => (card.textContent ?? "").toLocaleLowerCase().includes(w)
      );
      card.hidden = !visible;
      links[i].hidden = !visible;
      if (visible) {
        count++;
      }
    });
    document.getElementById("count").textContent = count + " / " + cards.length + " \u9805\u76EE";
    document.getElementById("empty").hidden = count !== 0;
  }
  search.addEventListener("input", filter);
  category.addEventListener("change", filter);
  document.getElementById("reset").onclick = () => {
    search.value = "";
    category.value = "";
    filter();
    search.focus();
  };
  document.getElementById("print").onclick = () => window.print();
  filter();
})();
//# sourceMappingURL=reference.js.map
