export function createNavigationMenuArrows() {
  // Go back in history
  const historyBackElement = document.createElement("span");
  historyBackElement.classList.add("material-symbols-outlined", "ytmd-history-back", "disabled");
  historyBackElement.innerText = "west";

  historyBackElement.addEventListener("click", function () {
    if (!historyBackElement.classList.contains("disabled")) {
      history.back();
    }
  });

  // Go forward in history
  const historyForwardElement = document.createElement("span");
  historyForwardElement.classList.add("material-symbols-outlined", "ytmd-history-forward", "disabled");
  historyForwardElement.innerText = "east";

  historyForwardElement.addEventListener("click", function () {
    if (!historyForwardElement.classList.contains("disabled")) {
      history.forward();
    }
  });

  function reconcileNavigationButtons() {
    if (navigation.canGoBack) {
      historyBackElement.classList.remove("disabled");
    } else {
      historyBackElement.classList.add("disabled");
    }

    if (navigation.canGoForward) {
      historyForwardElement.classList.remove("disabled");
    } else {
      historyForwardElement.classList.add("disabled");
    }
  }

  navigation.addEventListener("navigate", () => {
    reconcileNavigationButtons();
  });
  navigation.addEventListener("currententrychange", () => {
    reconcileNavigationButtons();
  });

  const pivotBar = document.querySelector("ytmusic-pivot-bar-renderer");
  if (!pivotBar) {
    // New YTM UI
    const searchBar = document.querySelector("ytmusic-search-box");
    const navBar = searchBar?.parentNode;
    navBar?.insertBefore(historyForwardElement, searchBar);
    navBar?.insertBefore(historyBackElement, historyForwardElement);
    if (searchBar instanceof HTMLElement) keepOpenedSearchBoxInPlace(searchBar);
  } else {
    historyForwardElement.classList.add("pivotbar");
    historyBackElement.classList.add("pivotbar");
    pivotBar.prepend(historyForwardElement);
    pivotBar.prepend(historyBackElement);
  }
}

// YTM takes the opened search box out of the flow, which moves it over the history buttons.
// It is shifted back to where it was while closed.
function keepOpenedSearchBoxInPlace(searchBox: HTMLElement) {
  let closedX = searchBox.getBoundingClientRect().x;

  new ResizeObserver(() => {
    if (!searchBox.hasAttribute("opened")) closedX = searchBox.getBoundingClientRect().x;
  }).observe(searchBox.parentElement ?? searchBox);

  new MutationObserver(() => {
    searchBox.style.marginLeft = "";
    if (searchBox.hasAttribute("opened")) {
      searchBox.style.marginLeft = `${closedX - searchBox.getBoundingClientRect().x}px`;
    } else {
      closedX = searchBox.getBoundingClientRect().x;
    }
  }).observe(searchBox, { attributes: true, attributeFilter: ["opened"] });
}
