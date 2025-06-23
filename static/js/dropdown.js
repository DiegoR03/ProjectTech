document.addEventListener('DOMContentLoaded', function () {
  const dropdowns = document.querySelectorAll('.dropdown');
  const dropdownsPets = document.querySelectorAll('.dropdownPet');

  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector('.dropbtn');
    
    const content = dropdown.querySelector('.dropdown-content');

    button.addEventListener('click', function (event) {
      event.stopPropagation(); // Prevent window click from firing

      // Close all other dropdowns
      document.querySelectorAll('.dropdown-content').forEach(drop => {
        if (drop !== content) drop.style.display = 'none';
      });


      // Toggle this one
      content.style.display = (content.style.display === 'block') ? 'none' : 'block';
    });
  });

  // Close dropdowns when clicking outside
  window.addEventListener('click', function (event) {
  document.querySelectorAll('.dropdown-content').forEach(drop => {
      drop.style.display = 'none';
    });
});

  dropdownsPets.forEach(dropdown => {
    const petbutton = dropdown.querySelector('.dropPetbtn');
  
    const petcontent = dropdown.querySelector('.dropdown-petcontent');

    petbutton.addEventListener('click', function (event) {
      event.stopPropagation(); // Prevent window click from firing

      document.querySelectorAll('.dropdown-petcontent').forEach(drop => {
        if (drop !== petcontent) drop.style.display = 'none';
      });

      // Toggle this one
      petcontent.style.display = (petcontent.style.display === 'block') ? 'none' : 'block';
    });
  });

  window.addEventListener('click', function (event) {
  document.querySelectorAll('.dropdown-petcontent').forEach(drop => {
      drop.classList.remove('open');
    });
});
});
