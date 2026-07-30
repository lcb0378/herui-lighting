const state = {
  filterId: "all",
  mode: "website",
  query: "",
  selected: window.PRODUCTS[0],
  cart: [],
  lastSubmission: null,
  cartOpen: false,
};

const filterGroups = [
  {
    title: "Product Type",
    items: [
      { id: "all", label: "All Products", match: () => true },
      { id: "pendant", label: "Pendant / Small Pendant", match: hasAny("pendant", "small") },
      { id: "chandelier", label: "Chandeliers", match: hasAny("chandelier") },
      { id: "wall", label: "Wall Sconces", match: hasAny("wall sconce") },
      { id: "ceiling", label: "Ceiling Lights", match: hasAny("ceiling") },
      { id: "table", label: "Table Lamps", match: hasAny("table lamp") },
      { id: "floor", label: "Floor Lamps", match: hasAny("floor lamp") },
      { id: "fan", label: "Fan Lights", match: hasAny("fan light") },
      { id: "stair", label: "Stair / Lobby Lights", match: hasAny("stair", "lobby") },
      { id: "dining", label: "Dining Lights", match: hasAny("dining", "restaurant") },
    ],
  },
  {
    title: "Material",
    items: [
      { id: "copper", label: "Copper / Brass", match: hasAny("copper", "brass") },
      { id: "crystal", label: "Crystal / Glass", match: hasAny("crystal", "glass") },
      { id: "wood", label: "Wood + Copper", match: hasAny("wood", "walnut") },
      { id: "marble", label: "Marble / Stone", match: hasAny("marble", "stone") },
      { id: "black", label: "Black Finish", match: hasAny("black", "gun black") },
      { id: "led", label: "LED / Full Spectrum", match: hasAny("led", "full-spectrum", "tri-color") },
    ],
  },
  {
    title: "Style & Application",
    items: [
      { id: "modern", label: "Modern Minimal", match: hasAny("modern", "apartment") },
      { id: "luxury", label: "Light Luxury", match: hasAny("premium", "luxury", "villa") },
      { id: "hotel", label: "Hotel / Project", match: hasAny("hotel", "project", "lobby") },
      { id: "villa", label: "Villa / Residential", match: hasAny("villa", "residential", "bedroom") },
      { id: "restaurant", label: "Restaurant / Dining", match: hasAny("restaurant", "dining") },
      { id: "africa", label: "Africa Wholesale", match: hasAny("africa") },
      { id: "middle-east", label: "Middle East", match: hasAny("middle east") },
    ],
  },
];

const catalogView = document.querySelector("#catalogView");
const miniList = document.querySelector("#miniList");
const searchInput = document.querySelector("#search");
const modeButtons = document.querySelectorAll(".mode-switch button");
const addSelected = document.querySelector("#addSelected");
const modal = document.querySelector("#productModal");
const categoryPanel = document.querySelector("#categoryPanel");
const submitCart = document.querySelector("#submitCart");
const drawerSubmitCart = document.querySelector("#drawerSubmitCart");
const cartToggle = document.querySelector("#cartToggle");
const cartDrawer = document.querySelector("#cartDrawer");

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    modeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
    document.querySelector("#catalog").scrollIntoView({ block: "start" });
  });
});

document.querySelectorAll("[data-close-modal]").forEach((node) => node.addEventListener("click", closeModal));
document.querySelectorAll("[data-close-cart]").forEach((node) => node.addEventListener("click", closeCartDrawer));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    closeCartDrawer();
  }
});

cartToggle.addEventListener("click", openCartDrawer);
addSelected.addEventListener("click", () => addToCart(state.selected, addSelected));
submitCart.addEventListener("click", submitQuoteList);
drawerSubmitCart.addEventListener("click", submitQuoteList);

function hasAny(...terms) {
  return (product) => {
    const text = productSearchText(product);
    return terms.some((term) => text.includes(term.toLowerCase()));
  };
}

function productSearchText(product) {
  return [
    product.code,
    product.title,
    product.category,
    product.market,
    product.material,
    product.size,
    product.light,
    product.finish,
    product.description,
    product.scene,
    product.reason,
  ]
    .join(" ")
    .toLowerCase();
}

function currentFilter() {
  return filterGroups.flatMap((group) => group.items).find((item) => item.id === state.filterId);
}

function filteredProducts() {
  const query = state.query.trim().toLowerCase();
  const filter = currentFilter();
  return window.PRODUCTS.filter((product) => {
    const text = productSearchText(product);
    return filter.match(product) && (!query || text.includes(query));
  });
}

function countFor(item) {
  return window.PRODUCTS.filter((product) => item.match(product)).length;
}

function cartCount() {
  return state.cart.reduce((total, item) => total + item.quantity, 0);
}

function addToCart(product, source) {
  const existing = state.cart.find((item) => item.product.slug === product.slug);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ product, quantity: 1 });
  }
  state.lastSubmission = null;
  renderCart();
  animateCartAdd(product, source);
  pulseCartButton();
}

function updateCartQuantity(slug, quantity) {
  const item = state.cart.find((entry) => entry.product.slug === slug);
  if (!item) return;
  item.quantity = Math.max(1, Math.min(9999, Number(quantity) || 1));
  state.lastSubmission = null;
  renderCart();
}

function openCartDrawer() {
  state.cartOpen = true;
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  cartToggle.setAttribute("aria-expanded", "true");
}

function closeCartDrawer() {
  state.cartOpen = false;
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  cartToggle.setAttribute("aria-expanded", "false");
}

function pulseCartButton() {
  cartToggle.classList.remove("cart-pulse");
  void cartToggle.offsetWidth;
  cartToggle.classList.add("cart-pulse");
}

function animateButton(source) {
  if (!source) return;
  source.classList.remove("button-pop");
  void source.offsetWidth;
  source.classList.add("button-pop");
}

function animateCartAdd(product, source) {
  animateButton(source);
  if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = source.getBoundingClientRect();
  const target = cartToggle.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = "cart-flyer";
  flyer.innerHTML = `<img src="${product.image}" alt=""><span>${product.code}</span>`;
  document.body.appendChild(flyer);
  flyer.style.left = `${start.left + start.width / 2}px`;
  flyer.style.top = `${start.top + start.height / 2}px`;

  requestAnimationFrame(() => {
    flyer.style.transform = `translate(calc(-50% + ${target.left + target.width / 2 - start.left - start.width / 2}px), calc(-50% + ${target.top + target.height / 2 - start.top - start.height / 2}px)) scale(0.38)`;
    flyer.style.opacity = "0.08";
  });

  flyer.addEventListener("transitionend", () => flyer.remove(), { once: true });
}

function removeFromCart(slug) {
  state.cart = state.cart.filter((item) => item.product.slug !== slug);
  state.lastSubmission = null;
  renderCart();
}

function submitQuoteList() {
  const status = document.querySelector("#submitStatus");
  if (state.cart.length === 0) {
    status.textContent = "Please add products to the cart before submitting.";
    return;
  }

  state.lastSubmission = {
    submittedAt: new Date().toISOString(),
    items: state.cart.map(({ product, quantity }) => ({
      model: product.code,
      category: product.category,
      quantity,
      image: product.image,
      size: product.size,
      material: product.material,
      light: product.light,
      finish: product.finish,
    })),
  };
  try {
    window.localStorage.setItem("heruiQuoteCart", JSON.stringify(state.lastSubmission));
  } catch (error) {
    console.warn("Quote cart could not be saved locally.", error);
  }
  renderCart();
}

function selectProduct(product) {
  state.selected = product;
  renderModal();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function renderCategoryMenu() {
  categoryPanel.innerHTML = filterGroups
    .map(
      (group) => `
        <div class="menu-group">
          <h4>${group.title}</h4>
          ${group.items
            .filter((item) => item.id === "all" || countFor(item) > 0)
            .map(
              (item) => `
                <button class="menu-item ${state.filterId === item.id ? "active" : ""}" data-filter="${item.id}">
                  <span>${item.label}</span>
                  <small>${countFor(item)}</small>
                </button>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");

  categoryPanel.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filterId = button.dataset.filter;
      render();
      document.querySelector("#catalog").scrollIntoView({ block: "start" });
    });
  });
}

function renderCatalog() {
  const filtered = filteredProducts();
  const items = state.mode === "mini" ? filtered.slice(0, 36) : filtered;
  const filter = currentFilter();
  document.querySelector("#categoryTitle").textContent = filter.label;
  document.querySelector("#catalogCount").textContent =
    state.mode === "mini" ? `${items.length} previewed / ${filtered.length} total` : `${items.length} shown`;

  catalogView.innerHTML = items
    .map(
      (product) => `
        <article class="product" data-select="${product.slug}">
          <img src="${product.image}" alt="${product.title}" loading="lazy">
          <div class="product-body">
            <p>${product.category}</p>
            <h3>${product.code}</h3>
            <span class="open-detail">View specifications</span>
            <button class="quote" data-add="${product.slug}">Add to cart</button>
          </div>
        </article>
      `,
    )
    .join("");

  catalogView.querySelectorAll("[data-select]").forEach((card) => {
    card.addEventListener("click", () => {
      const product = window.PRODUCTS.find((item) => item.slug === card.dataset.select);
      selectProduct(product);
    });
  });

  catalogView.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const product = window.PRODUCTS.find((item) => item.slug === button.dataset.add);
      addToCart(product, button);
    });
  });
}

function renderMini() {
  const items = filteredProducts().slice(0, 12);
  miniList.innerHTML = items
    .map(
      (product) => `
        <article class="mini-item">
          <img src="${product.image}" alt="${product.title}">
          <span>
            <strong>${product.code}</strong>
            <small>${product.category}</small>
            <em>Mobile preview</em>
          </span>
        </article>
      `,
    )
    .join("");
}

function renderModal() {
  const product = state.selected;
  document.querySelector("#modalImage").src = product.image;
  document.querySelector("#modalImage").alt = product.title;
  document.querySelector("#modalCode").textContent = product.code;
  document.querySelector("#modalMarket").textContent = product.market;
  document.querySelector("#modalSpecs").innerHTML = [
    ["Category", product.category],
    ["Model", product.model || product.code],
    ["Size", product.size],
    ["Material", product.material],
    ["Light source", product.light],
    ["Finish", product.finish],
    ["Application", product.scene],
    ["Description", product.description],
  ]
    .filter(([, value]) => value && value !== "To confirm from supplier")
    .map(([label, value]) => `
      <div class="${label === "Description" ? "spec-wide" : ""}">
        <dt>${label}</dt>
        <dd>${value}</dd>
      </div>
    `)
    .join("");
}

function renderCart() {
  const total = cartCount();
  document.querySelector("#miniCount").textContent = total;
  document.querySelector("#cartBadge").textContent = total;
  document.querySelector("#drawerCartCount").textContent =
    state.cart.length === 0 ? "0 products" : `${state.cart.length} models / ${total} pcs`;
  submitCart.disabled = state.cart.length === 0;
  drawerSubmitCart.disabled = state.cart.length === 0;
  renderCartList(document.querySelector("#inquiryList"));
  renderCartList(document.querySelector("#cartDrawerList"));
  renderSubmitStatus(document.querySelector("#submitStatus"));
  renderSubmitStatus(document.querySelector("#drawerSubmitStatus"));
}

function renderCartList(list) {
  if (!list) return;

  if (state.cart.length === 0) {
    list.textContent = "No products added yet.";
    return;
  }

  list.innerHTML = state.cart
    .map(
      ({ product, quantity }) => `
        <article class="cart-item">
          <img src="${product.image}" alt="${product.title}">
          <div class="cart-copy">
            <strong>${product.code}</strong>
            <span>${product.category}</span>
          </div>
          <div class="quantity-control" aria-label="Quantity for ${product.code}">
            <button data-qty-minus="${product.slug}" aria-label="Decrease quantity">-</button>
            <input data-qty-input="${product.slug}" type="number" min="1" max="9999" value="${quantity}">
            <button data-qty-plus="${product.slug}" aria-label="Increase quantity">+</button>
          </div>
          <button class="remove-cart" data-remove="${product.slug}">Remove</button>
        </article>
      `,
    )
    .join("");

  list.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => removeFromCart(button.dataset.remove));
  });
  list.querySelectorAll("[data-qty-minus]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.cart.find((entry) => entry.product.slug === button.dataset.qtyMinus);
      updateCartQuantity(button.dataset.qtyMinus, (item?.quantity || 1) - 1);
    });
  });
  list.querySelectorAll("[data-qty-plus]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.cart.find((entry) => entry.product.slug === button.dataset.qtyPlus);
      updateCartQuantity(button.dataset.qtyPlus, (item?.quantity || 1) + 1);
    });
  });
  list.querySelectorAll("[data-qty-input]").forEach((input) => {
    input.addEventListener("change", () => updateCartQuantity(input.dataset.qtyInput, input.value));
  });
}

function renderSubmitStatus(status) {
  status.innerHTML = state.lastSubmission
    ? `
      <strong>Quote list submitted.</strong>
      <span>${state.lastSubmission.items.length} models / ${cartCount()} pcs ready for wholesale quotation.</span>
    `
    : "";
}

function render() {
  renderCategoryMenu();
  renderCatalog();
  renderMini();
  renderModal();
  renderCart();
}

render();
