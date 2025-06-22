document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.like-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();

            const petId = button.getAttribute('href').split('/').pop();
            const heartIcon = button.querySelector('.heart-icon');

            // Restart animation
            heartIcon.classList.remove('animate');
            void heartIcon.offsetWidth;
            heartIcon.classList.add('animate');

            try {
                const res = await fetch(`/fave/${petId}`);
                if (res.status === 401) {
                    // Not logged in, redirect to login page
                    window.location.href = '/login';
                    return;
                }
                
                const data = await res.json();

                if (data.status === 'success') {
                    if (data.favorited) {
                        heartIcon.classList.add('liked');
                    } else {
                        heartIcon.classList.remove('liked');
                    }
                } else {
                    console.error('Error favoriting:', data.message);
                }
            } catch (err) {
                console.error('Request failed:', err);
            }
        });
    });
});
