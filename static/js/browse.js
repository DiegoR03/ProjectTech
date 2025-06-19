document.addEventListener('DOMContentLoaded', function () {
  const advancedFilterBtn = document.getElementById('toggle-advanced');
  const advancedFilters = document.getElementById('advanced-filters');



  advancedFilterBtn.addEventListener('click', () => {
    advancedFilters.classList.toggle('hidden');

    if (advancedFilters.classList.contains('hidden')) {
      advancedFilterBtn.innerHTML = '&#43;   Filters'; //+
      advancedFilterBtn.classList.remove('openFilters');

    } else {
      advancedFilterBtn.innerHTML = '&#8722;   Filters'; //-
      advancedFilterBtn.classList.add('openFilters');

    }
  });

  const loaderDiv = document.getElementById("loaderDiv");
  const form = document.getElementById("filter-form");
  const resultGrid = document.getElementById("result-grid");

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // voorkomen dat pagina herlaadt
    loaderDiv.classList.add("loading");
    if (resultGrid) resultGrid.style.display = "none";

    // Bouw de query
    const formData = new FormData(form);
    const params = new URLSearchParams(formData);

    try {
      const response = await fetch(`/browse?${params.toString()}`);
      const html = await response.text();

      // Herschrijf een deel van de pagina met nieuwe inhoud (alleen resultaat-grid bijvoorbeeld)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newGrid = doc.getElementById("result-grid");
      const newPagination = doc.querySelector(".pages");
      const newResultCount = doc.querySelector(".results");
      const newActiveFilters = doc.querySelector(".active-filters");

      // Vervang active filters
      const activeFiltersDiv = document.querySelector(".active-filters");
      if (newActiveFilters && activeFiltersDiv) {
        activeFiltersDiv.innerHTML = newActiveFilters.innerHTML;
      } else if (newActiveFilters && !activeFiltersDiv) {
        // Als er nog geen active-filters element bestaat (bijv. eerste keer filteren)
        const filtersSection = document.querySelector(".filters");
        filtersSection.insertAdjacentElement("beforeend", newActiveFilters);
      }

      if (resultGrid && newGrid) {
        resultGrid.innerHTML = newGrid.innerHTML;
        resultGrid.style.display = "grid";
      }

      // Vervang result count en paginatie ook als je wil:
      if (newResultCount) {
        document.querySelector(".results").innerHTML = newResultCount.innerHTML;
      }
      if (newPagination) {
        document.querySelector(".pages").innerHTML = newPagination.innerHTML;
      }

    } catch (err) {
      console.error("Error fetching filtered results", err);
    } finally {
      loaderDiv.classList.remove("loading");
    }
  });

});