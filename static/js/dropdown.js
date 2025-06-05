document.addEventListener('DOMContentLoaded', function () {
  const dropdownBtn = document.querySelector('.dropbtn');
  const dropdownContent = document.getElementById('myDropdown');

  if (dropdownBtn && dropdownContent) {
    dropdownBtn.addEventListener('click', function (event) {
      event.stopPropagation(); // Prevent window click from firing
      dropdownContent.style.display =
        dropdownContent.style.display === 'block' ? 'none' : 'block';
    });

    window.addEventListener('click', function (event) {
      if (!event.target.closest('.dropdown')) {
        dropdownContent.style.display = 'none';
      }
    });
  }
});
