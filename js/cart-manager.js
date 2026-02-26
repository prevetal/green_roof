jQuery(document).ready(function($) {

    const CART_STORAGE_KEY = 'cart_items';
    const cartCountElement = $('#cart-count');
    const cartCountElement2 = $('#cart-count2');
    const cartPageCountElement = $('#cart-page-count');
    const cartItemsList = $('#cart-items-list');
    const cartTotalPriceElement = $('#cart-total-price');
    const cartEmptyBlock = $('.cart_empty_block');
    const cartContentBlock = $('#cart-content-block');

    let hideModalTimeout; // Объявляем переменную для хранения идентификатора таймера

    const template_url = cart_vars.template_url;

    // --- Флаг для управления состоянием AJAX ---
    let is_ajax_in_progress = false; // Добавляем этот флаг

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
        cartCountElement2.text(totalItemsInCart);

        if (cartPageCountElement.length) {
            if (cartSummaryText) {
                 cartPageCountElement.text(cartSummaryText);
            } else {
                const productsText = pluralize(totalItemsInCart, ['товар', 'товара', 'товаров']);
                cartPageCountElement.text(`${totalItemsInCart} ${productsText}`);
            }

            if (totalItemsInCart === 0) {
                cartEmptyBlock.show();
                cartContentBlock.hide();
                cartItemsList.empty();
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

    // Вспомогательная функция для склонения слов
    function pluralize(n, forms) {
        if (n % 10 === 1 && n % 100 !== 11) {
            return forms[0];
        } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
            return forms[1];
        } else {
            return forms[2];
        }
    }

    // --- Функции для отключения/включения кнопок и индикации загрузки ---
    // Отключаем все кнопки управления количеством в корзине (на странице cart.php)
    function disableCartControls() {
        if (cartItemsList.length) { // Только если мы на странице корзины
            cartItemsList.find('.cart-item-quantity-wrapper button').prop('disabled', true).addClass('loading-state');
            cartItemsList.find('.remove-from-cart-btn').prop('disabled', true).addClass('loading-state');
            cartItemsList.find('.cart-item-quantity-input').prop('disabled', true);
            is_ajax_in_progress = true;
        }
    }

    // Включаем все кнопки управления количеством в корзине
    function enableCartControls() {
        if (cartItemsList.length) { // Только если мы на странице корзины
            cartItemsList.find('.cart-item-quantity-wrapper button').prop('disabled', false).removeClass('loading-state');
            cartItemsList.find('.remove-from-cart-btn').prop('disabled', false).removeClass('loading-state');
            cartItemsList.find('.cart-item-quantity-input').prop('disabled', false);
            is_ajax_in_progress = false;
        }
    }
    // --- Конец функций управления состоянием ---


    /**
     * Асинхронная функция для получения актуальных данных о товарах корзины с сервера
     * и последующего рендеринга.
     */
    function fetchAndRenderCartItems() {
        if (!cartItemsList.length) return;

        const storedItems = getStoredCartItems();

        if (storedItems.length === 0) {
            updateCartCounter("0 товаров");
            $('.wpcf7-form input[name="cart-products-data"]').val('');
            enableCartControls(); // Включаем, если вдруг были отключены
            return;
        }

        disableCartControls(); // Отключаем кнопки перед AJAX-запросом

        $.ajax({
            url: cart_vars.ajax_url,
            type: 'POST',
            data: {
                action: 'get_cart_products_data',
                cart_items: JSON.stringify(storedItems)
            },
            success: function(response) {
                if (response.success && response.data.products) {
                    const products = response.data.products;
                    let totalCartPrice = response.data.total_price;
                    const cartSummaryText = response.data.cart_summary_text;
                    cartItemsList.empty();

                    if (products.length === 0) {
                        updateCartCounter("0 товаров");
                        enableCartControls();
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
                    updateCartCounter(cartSummaryText);

                    $('.wpcf7-form input[name="cart-products-data"]').val(JSON.stringify(products));

                    addCartItemEventHandlers();

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
            },
            complete: function() {
                enableCartControls(); // Включаем кнопки после завершения AJAX
            }
        });
    }


    // ====== Обработчики событий для кнопок "В корзину" ======
    $(document).on('click', '.add-to-cart-btn', function(e) {
        e.preventDefault();
        const $this = $(this);
        let productId, quantity;

        if ($this.closest('.product_info').length) {
            const $productDataContainer = $this.closest('.data');
            productId = $productDataContainer.data('product-id');
            quantity = parseInt($productDataContainer.find('.product-quantity-input').val()) || 1;
        } else {
            productId = $this.data('product-id');
            quantity = 1;
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
        //alert('Товар добавлен в корзину!');
        
        // Отключаем кнопку "Добавить в корзину" на время показа модалки
        $(this).prop("disabled", true);

        // --- Изменения для обработки модального окна ---

        // 1. Очищаем предыдущий таймер, если он существует
        clearTimeout(hideModalTimeout);                 

        // 2. Сначала скрываем текущее модальное окно, чтобы оно не накладывалось
        //    Это создаст эффект "перезапуска" модального окна
        $('.product_added_modal').fadeOut(100, function() {
            // Callback-функция: после того как модалка исчезнет, обновляем контент и показываем новую
            $(".product_added_modal .thumb img").attr("src", $this.data("img"));
            $(".product_added_modal .name").text($this.data("name"));
            $(".product_added_modal .value").text($this.data("price"));

            $('.product_added_modal').fadeIn(200);
            $('.product_added_modal .progress').removeClass('animate'); // Сброс анимации перед повторным запуском
            void $('.product_added_modal .progress')[0].offsetWidth; // Используем void, чтобы убедиться, что значение не используется
            setTimeout(() => { // Небольшая задержка, чтобы анимация сбросилась перед добавлением класса
                $('.product_added_modal .progress').addClass('animate');
            }, 0); // Очень маленькая задержка, чтобы браузер успел перерисовать

            // 3. Сохраняем идентификатор нового таймера в переменной
            hideModalTimeout = setTimeout(() => {
                $('.product_added_modal').fadeOut(100);
                $('.product_added_modal .progress').removeClass('animate');
                // Включаем все кнопки "Добавить в корзину" после закрытия модалки
                // Если нужно включать только ту, которая была нажата, используйте $this.prop("disabled", false);
                $('.add-to-cart-btn').prop("disabled", false); 
            }, 3000);
        });
        // --- Конец изменений для модального окна ---

        if (cartItemsList.length) { // Только если мы на странице корзины
            fetchAndRenderCartItems(); // Запрашиваем новые данные и перерендерим
        }

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
        const maxVal = parseInt($input.data('maximum')) || 99;
        if (currentVal < maxVal) {
            $input.val(currentVal + 1);
        }
    });

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

        cartItemsList.on('click', '.cart-quantity-minus', function(e) {
            if (is_ajax_in_progress) { // Проверяем флаг
                e.preventDefault();
                return;
            }
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            const $input = $(this).siblings('.cart-item-quantity-input');
            let currentVal = parseInt($input.val());
            const minVal = parseInt($input.data('minimum')) || 1;

            if (currentVal > minVal) {
                currentVal--;
                $input.val(currentVal);
                updateStoredCartItemQuantity(productId, currentVal);
            }
        });

        cartItemsList.on('click', '.cart-quantity-plus', function(e) {
            if (is_ajax_in_progress) { // Проверяем флаг
                e.preventDefault();
                return;
            }
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            const $input = $(this).siblings('.cart-item-quantity-input');
            let currentVal = parseInt($input.val());
            const maxVal = parseInt($input.data('maximum')) || 99;

            if (currentVal < maxVal) {
                currentVal++;
                $input.val(currentVal);
                updateStoredCartItemQuantity(productId, currentVal);
            }
        });

        cartItemsList.on('change', '.cart-item-quantity-input', function(e) {
           if (is_ajax_in_progress) { // Проверяем флаг
                e.preventDefault();
                return;
            }
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
            $(this).val(currentVal);
            updateStoredCartItemQuantity(productId, currentVal);
        });


        cartItemsList.on('click', '.remove-from-cart-btn', function(e) {
            if (is_ajax_in_progress) { // Проверяем флаг
                e.preventDefault();
                return;
            }
            const $productDiv = $(this).closest('.product');
            const productId = $productDiv.data('product-id');
            removeStoredCartItem(productId);
        });
    }

    function updateStoredCartItemQuantity(productId, newQuantity) {
        let storedItems = getStoredCartItems();
        const itemIndex = storedItems.findIndex(item => item.id == productId);

        if (itemIndex > -1) {
            storedItems[itemIndex].quantity = newQuantity;
            saveStoredCartItems(storedItems);
            fetchAndRenderCartItems(); // Запрашиваем новые данные и перерендерим
        }
    }

    function removeStoredCartItem(productId) {
        let storedItems = getStoredCartItems();
        storedItems = storedItems.filter(item => item.id != productId);
        saveStoredCartItems(storedItems);
        fetchAndRenderCartItems(); // Запрашиваем новые данные и перерендерим
    }


    // ====== Инициализация при загрузке страницы ======
    updateCartCounter();

    if ($('#cart-items-list').length) {
        fetchAndRenderCartItems();
    }


    // ====== Обработчики событий Contact Form 7 ======
    // Очищаем корзину в localStorage после успешной отправки формы CF7
    document.addEventListener('wpcf7mailsent', function(event) {
        // Убедитесь, что это нужная форма CF7, если у вас их несколько
        // (Обычно проверяют event.detail.contactFormId, если нужно)
        if ( '188' == event.detail.contactFormId ) {        
            localStorage.removeItem(CART_STORAGE_KEY);
            updateCartCounter();
            fetchAndRenderCartItems(); // Обновим корзину, чтобы показать, что она пуста
            $(event.target)[0].reset(); // Очистить поля формы CF7
            Fancybox.close()
            Fancybox.show([{
                src: '#thanks',
                type: 'inline'
            }])     
        }

        else{
            Fancybox.close()
            Fancybox.show([{
                src: '#thanks',
                type: 'inline'
            }])   
        }
    }, false);


    

    /*$('.add-to-cart-btn').click(function(e) {        
        
    });*/

    $('.product_added_modal .close_btn').click(function(e) {      

        // Очищаем таймер при закрытии модального окна
        clearTimeout(hideModalTimeout); 

        $('.product_added_modal').fadeOut(100);
        $('.product_added_modal .progress').removeClass('animate');
        $('.add-to-cart-btn').prop("disabled", false);
    });

});