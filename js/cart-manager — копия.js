jQuery(document).ready(function($) {

    const CART_STORAGE_KEY = 'cart_items'; // { id: product_id, quantity: N }
    const cartCountElement = $('#cart-count');
    const cartPageCountElement = $('#cart-page-count');
    const cartItemsList = $('#cart-items-list');
    const cartTotalPriceElement = $('#cart-total-price');
    const cartEmptyBlock = $('.cart_empty_block');
    const cartContentBlock = $('#cart-content-block');

    // Получаем URL шаблона из wp_localize_script
    const template_url = cart_vars.template_url;

    // Вспомогательная функция для получения товаров из localStorage
    function getStoredCartItems() {
        try {
            const items = localStorage.getItem(CART_STORAGE_KEY);
            return items ? JSON.parse(items) : [];
        } catch (e) {
            console.error("Error reading from localStorage", e);
            return [];
        }
    }

    // Вспомогательная функция для сохранения товаров в localStorage
    function saveStoredCartItems(items) {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            console.error("Error writing to localStorage", e);
        }
    }

    // Вспомогательная функция для обновления счетчика товаров в шапке
    function updateCartCounter(cartSummaryText = null) {
        const storedItems = getStoredCartItems();
        const totalItemsInCart = storedItems.reduce((sum, item) => sum + item.quantity, 0);
        cartCountElement.text(totalItemsInCart);

        // Обновление на странице корзины (с текстом "товар/товара/товаров")
        if (cartPageCountElement.length) {
            if (cartSummaryText) {
                 cartPageCountElement.text(cartSummaryText);
            } else {
                const productsText = pluralize(totalItemsInCart, ['товар', 'товара', 'товаров']); // Используем версию из functions.php для Js
                cartPageCountElement.text(`${totalItemsInCart} ${productsText}`);
            }


            // Показать/скрыть блоки корзины
            if (totalItemsInCart === 0) {
                cartEmptyBlock.show();
                cartContentBlock.hide();
                cartItemsList.empty(); // Убедимся, что список пуст
                cartTotalPriceElement.text('0 ₽');
                $(".page_head_non").hide();
                $(".page_head_if").show();
            } else {
                cartEmptyBlock.hide();
                cartContentBlock.show();
            }
        }
    }

    // Вспомогательная функция для форматирования цены
    function formatPrice(price) {
        return new Intl.NumberFormat('ru-RU').format(price);
    }

    // Вспомогательная функция для склонения слов (как в PHP plural_form_russian)
    function pluralize(n, forms) { // forms: ['товар', 'товара', 'товаров']
        if (n % 10 === 1 && n % 100 !== 11) {
            return forms[0];
        } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
            return forms[1];
        } else {
            return forms[2];
        }
    }

    /**
     * Асинхронная функция для получения актуальных данных о товарах корзины с сервера
     * и последующего рендеринга.
     */
    function fetchAndRenderCartItems() {
        if (!cartItemsList.length) return; // Выходим, если это не страница корзины

        const storedItems = getStoredCartItems();

        if (storedItems.length === 0) {
            updateCartCounter("0 товаров"); // Обновит и покажет пустой блок
             // Также очищаем скрытое поле CF7, если корзина пуста
            $('.wpcf7-form input[name="cart-products-data"]').val('');
            return;
        }

        $.ajax({
            url: cart_vars.ajax_url,
            type: 'POST',
            data: {
                action: 'get_cart_products_data',
                cart_items: JSON.stringify(storedItems) // Отправляем серверу только ID и количество
            },
            success: function(response) {
                if (response.success && response.data.products) {
                    const products = response.data.products;
                    let totalCartPrice = response.data.total_price;
                    const cartSummaryText = response.data.cart_summary_text;
                    cartItemsList.empty(); // Очищаем список перед рендерингом

                    if (products.length === 0) {
                        updateCartCounter("0 товаров"); // Если сервер вернул пустой список (например, товары не найдены)
                        return;
                    }

                    products.forEach(item => {
                        const productHtml = `
                            <div class="product" data-product-id="${item.id}">
                                <a href="${item.permalink || '#'}" class="image">
                                    <picture class="thumb">
                                        <img src="${item.image || (template_url + '/images/default_product.png')}" alt="${item.name}" loading="lazy">
                                    </picture>
                                </a>
                                <div class="info">
                                    <div class="row">
                                        <div class="name">
                                            <a href="${item.permalink || '#'}">${item.name}</a>
                                        </div>
                                        <div class="price">${formatPrice(item.price)} ₽</div>
                                    </div>
                                    <div class="row">
                                        <div class="amount cart-item-quantity-wrapper">
                                            <button type="button" class="btn minus cart-quantity-minus">
                                                <svg class="icon"><use xlink:href="${template_url}/images/sprite.svg#ic_minus"></use></svg>
                                            </button>
                                            <input type="text" value="${item.quantity}" class="input cart-item-quantity-input" data-minimum="1" data-maximum="99" data-step="1" data-unit="" maxlength="2">
                                            <button type="button" class="btn plus cart-quantity-plus">
                                                <svg class="icon"><use xlink:href="${template_url}/images/sprite.svg#ic_plus"></use></svg>
                                            </button>
                                        </div>
                                        <button class="delete_btn remove-from-cart-btn">
                                            <svg class="icon"><use xlink:href="${template_url}/images/sprite.svg#ic_remove"></use></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                        cartItemsList.append(productHtml);
                    });

                    cartTotalPriceElement.text(`${formatPrice(totalCartPrice)} ₽`);
                    updateCartCounter(cartSummaryText); // Обновим счетчик в шапке и на странице корзины

                    // Заполняем скрытое поле CF7 актуальными данными корзины
                    $('.wpcf7-form input[name="cart-products-data"]').val(JSON.stringify(products));

                    addCartItemEventHandlers(); // Добавим обработчики после рендера

                } else {
                    console.error('Error fetching cart products:', response.data);
                    cartItemsList.html('<p>Ошибка загрузки товаров в корзине. Пожалуйста, попробуйте обновить страницу.</p>');
                    cartTotalPriceElement.text('0 ₽');
                    updateCartCounter("0 товаров");
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error("AJAX error fetching cart products:", textStatus, errorThrown);
                cartItemsList.html('<p>Ошибка сети при загрузке корзины. Пожалуйста, проверьте ваше интернет-соединение.</p>');
                cartTotalPriceElement.text('0 ₽');
                updateCartCounter("0 товаров");
            }
        });
    }


    // ====== Обработчики событий для кнопок "В корзину" ======
    $(document).on('click', '.add-to-cart-btn', function(e) {
        e.preventDefault();
        const $this = $(this);
        let productId, quantity;

        // Если кнопка на странице товара
        if ($this.closest('.product_info').length) {
            const $productDataContainer = $this.closest('.data');
            productId = $productDataContainer.data('product-id');
            quantity = parseInt($productDataContainer.find('.product-quantity-input').val()) || 1;
        } else { // Если кнопка на странице категории/похожих товаров
            productId = $this.data('product-id');
            quantity = 1; // По умолчанию 1 для кнопок "В корзину" в списках
        }

        if (!productId) {
            console.error('Missing product ID for adding to cart.');
            return;
        }

        let storedItems = getStoredCartItems();
        let existingItem = storedItems.find(item => item.id == productId);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            storedItems.push({
                id: productId,
                quantity: quantity
            });
        }

        saveStoredCartItems(storedItems);
        updateCartCounter();
        alert('Товар добавлен в корзину!'); // Можно заменить на более красивое уведомление
    });


    // ====== Обработчики событий для изменения количества на странице товара ======
    $(document).on('click', '.product-quantity-wrapper .quantity-minus', function() {
        const $input = $(this).siblings('.product-quantity-input');
        let currentVal = parseInt($input.val());
        const minVal = parseInt($input.data('minimum')) || 1;
        if (currentVal > minVal) {
            $input.val(currentVal - 1);
        }
    });

    $(document).on('click', '.product-quantity-wrapper .quantity-plus', function() {
        const $input = $(this).siblings('.product-quantity-input');
        let currentVal = parseInt($input.val());
        const maxVal = parseInt($input.data('maximum')) || 99; // Или любое другое максимальное значение
        if (currentVal < maxVal) {
            $input.val(currentVal + 1);
        }
    });

    // Обработка ручного ввода (можно добавить debounce для больших объемов)
    $(document).on('change', '.product-quantity-input', function() {
        let currentVal = parseInt($(this).val());
        const minVal = parseInt($(this).data('minimum')) || 1;
        const maxVal = parseInt($(this).data('maximum')) || 99;

        if (isNaN(currentVal) || currentVal < minVal) {
            $(this).val(minVal);
        } else if (currentVal > maxVal) {
            $(this).val(maxVal);
        }
    });

    // ====== Функции и обработчики для страницы корзины ======
    function addCartItemEventHandlers() {
        // Отвязываем предыдущие обработчики, чтобы избежать множественных вызовов
        cartItemsList.off('click', '.cart-quantity-minus');
        cartItemsList.off('click', '.cart-quantity-plus');
        cartItemsList.off('change', '.cart-item-quantity-input');
        cartItemsList.off('click', '.remove-from-cart-btn');

        cartItemsList.on('click', '.cart-quantity-minus', function() {
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            const $input = $(this).siblings('.cart-item-quantity-input');
            let currentVal = parseInt($input.val());
            const minVal = parseInt($input.data('minimum')) || 1;

            if (currentVal > minVal) {
                currentVal--;
                $input.val(currentVal);
                updateStoredCartItemQuantity(productId, currentVal); // Обновляем localStorage
            }
        });

        cartItemsList.on('click', '.cart-quantity-plus', function() {
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            const $input = $(this).siblings('.cart-item-quantity-input');
            let currentVal = parseInt($input.val());
            const maxVal = parseInt($input.data('maximum')) || 99;

            if (currentVal < maxVal) {
                currentVal++;
                $input.val(currentVal);
                updateStoredCartItemQuantity(productId, currentVal); // Обновляем localStorage
            }
        });

        cartItemsList.on('change', '.cart-item-quantity-input', function() {
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            let currentVal = parseInt($(this).val());
            const minVal = parseInt($(this).data('minimum')) || 1;
            const maxVal = parseInt($(this).data('maximum')) || 99;

            if (isNaN(currentVal) || currentVal < minVal) {
                currentVal = minVal;
            } else if (currentVal > maxVal) {
                currentVal = maxVal;
            }
            $(this).val(currentVal); // Устанавливаем корректное значение
            updateStoredCartItemQuantity(productId, currentVal); // Обновляем localStorage
        });


        // Удаление товара из корзины
        cartItemsList.on('click', '.remove-from-cart-btn', function() {
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            removeStoredCartItem(productId);
        });
    }

    // Обновить количество товара в localStorage и перерендерить корзину
    function updateStoredCartItemQuantity(productId, newQuantity) {
        let storedItems = getStoredCartItems();
        const itemIndex = storedItems.findIndex(item => item.id == productId);

        if (itemIndex > -1) {
            storedItems[itemIndex].quantity = newQuantity;
            saveStoredCartItems(storedItems);
            fetchAndRenderCartItems(); // Запрашиваем новые данные и перерендерим
        }
    }

    // Удалить товар из localStorage и перерендерить корзину
    function removeStoredCartItem(productId) {
        let storedItems = getStoredCartItems();
        storedItems = storedItems.filter(item => item.id != productId); // Удаляем товар с этим ID
        saveStoredCartItems(storedItems);
        fetchAndRenderCartItems(); // Запрашиваем новые данные и перерендерим
    }


    // ====== Инициализация при загрузке страницы ======
    updateCartCounter();

    // Если мы на странице корзины, инициируем AJAX-запрос для рендера содержимого
    if ($('#cart-items-list').length) {
        fetchAndRenderCartItems();
    }


    // ====== Обработчики событий Contact Form 7 ======
    // Заполняем скрытое поле перед отправкой формы CF7
    // Используем 'wpcf7submit' для перехвата момента перед AJAX-отправкой CF7
    document.addEventListener('wpcf7submit', function(event) {
        const formId = event.detail.contactFormId;
        const currentFormId = $(event.target).find('[name="_wpcf7"]').val(); // ID вашей формы или проверка по классу

        // Проверяем, что это нужная форма CF7 (возможно, у вас несколько форм)
        // Замените YOUR_CF7_FORM_ID на реальный ID вашей формы, если он нужен
        // if (formId == YOUR_CF7_FORM_ID) {
            const storedItems = getStoredCartItems();
            // Скрытое поле уже должно быть заполнено функцией fetchAndRenderCartItems
            // Но мы можем убедиться, что оно актуально, или сделать дополнительную проверку
            // Например, здесь можно еще раз получить данные с сервера для скрытого поля,
            // но это может замедлить отправку. Лучше полагаться на fetchAndRenderCartItems
            // и дополнительную проверку на сервере (что уже сделано в cf7_add_cart_data_to_mail_body).

            // Если вы хотите очищать корзину только после успешной отправки формы CF7,
            // то добавьте слушатель на `wpcf7mailsent`
        // }
    }, false);

    // Очищаем корзину в localStorage после успешной отправки формы CF7
    document.addEventListener('wpcf7mailsent', function(event) {
        // Убедитесь, что это нужная форма CF7, если у вас их несколько
        // if (event.detail.contactFormId == YOUR_CF7_FORM_ID) {
            localStorage.removeItem(CART_STORAGE_KEY);
            updateCartCounter();
            fetchAndRenderCartItems(); // Обновим корзину, чтобы показать, что она пуста
             // Дополнительно можно очистить поля формы
            $(event.target)[0].reset();
        // }
    }, false);

});