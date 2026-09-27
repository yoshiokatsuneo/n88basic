const search = document.getElementById("search") as HTMLInputElement,
  category = document.getElementById("category") as HTMLSelectElement;
const cards = Array.from(document.querySelectorAll("article"));
const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("nav a"));
function filter() {
  const words = search.value
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  let count = 0;
  cards.forEach((card, i) => {
    const visible =
      (!category.value || card.dataset.group === category.value) &&
      words.every((w) =>
        (card.textContent ?? "").toLocaleLowerCase().includes(w),
      );
    card.hidden = !visible;
    links[i].hidden = !visible;
    if (visible) {
      count++;
    }
  });
  document.getElementById("count")!.textContent =
    count + " / " + cards.length + " 項目";
  document.getElementById("empty")!.hidden = count !== 0;
}
search.addEventListener("input", filter);
category.addEventListener("change", filter);
document.getElementById("reset")!.onclick = () => {
  search.value = "";
  category.value = "";
  filter();
  search.focus();
};
document.getElementById("print")!.onclick = () => window.print();
filter();

export {};
