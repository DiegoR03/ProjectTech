// document.querySelectorAll('.like-button .heart-icon').forEach(icon => {
//     icon.addEventListener('click', e => {
//       e.preventDefault(); // Stop immediate link navigation
//       icon.classList.toggle('liked');
  
//       icon.style.pointerEvents = 'none';
  
//       // Wait for the animation to finish
//       setTimeout(() => {
//         window.location.href = icon.closest('a').href;
//       }, 700);
  
//       // Re-enable pointer events after animation
//       setTimeout(() => {
//         icon.style.pointerEvents = 'auto';
//       }, 800);
//     });
// });

document.querySelectorAll('.like-button').forEach(link => {
  const heartIcon = link.querySelector('.heart-icon');

  heartIcon.addEventListener('click', async e => {
    e.preventDefault(); // prevent the page from following the link

    // Add animation
    heartIcon.classList.toggle('liked');
    heartIcon.style.pointerEvents = 'none';

    try {
      const response = await fetch(link.href, {
        method: 'GET', // must match your server route
        credentials: 'include' // if you're using sessions
      });

      if (!response.ok) {
        throw new Error('Failed to save favorite');
      }

      // Optional: log or show a UI confirmation
      console.log(await response.text());

    } catch (err) {
      console.error('Error saving favorite:', err);
      // Optionally undo animation
    }

    setTimeout(() => {
      heartIcon.style.pointerEvents = 'auto';
    }, 800);
  });
});