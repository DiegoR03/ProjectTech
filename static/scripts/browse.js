document.addEventListener('DOMContentLoaded', function () {
  const advancedFilterBtn = document.getElementById('toggle-advanced');
  const advancedFilters = document.getElementById('advanced-filters');



  advancedFilterBtn.addEventListener('click', () => {
    advancedFilters.classList.toggle('hidden');

    if (advancedFilters.classList.contains('hidden')) {
      advancedFilterBtn.innerHTML = '&#43;   Filters';
    } else {
      advancedFilterBtn.innerHTML = '&#8722;   Filters';
    }
  });



});