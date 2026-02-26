import { setOptions, importLibrary } from "@googlemaps/js-api-loader"

let isLoaderInitialized = false

export const initGoogleMaps = async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error("請在 .env 檔案中設定有效的 VITE_GOOGLE_MAPS_API_KEY")
    }

    if (!isLoaderInitialized) {
        setOptions({
            key: apiKey,
            v: "weekly"
        })
        isLoaderInitialized = true
    }

    try {
        const mapsPromise = importLibrary("maps")
        const placesPromise = importLibrary("places")
        const routesPromise = importLibrary("routes")

        await Promise.all([mapsPromise, placesPromise, routesPromise])

        return window.google.maps
    } catch (err) {
        console.error("Google Maps 載入失敗:", err)
        throw new Error("Google Maps SDK 載入失敗，請檢查網路或 API Key 配置。")
    }
}

export const fetchNearbyRestaurants = async ({ lat, lng, radius, minRating }) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
        throw new Error("Google Maps Places 程式庫未載入")
    }

    const { Place, SearchNearbyRankPreference } = window.google.maps.places
    const center = { lat: parseFloat(lat), lng: parseFloat(lng) }

    const request = {
        fields: [
            'id', 'displayName', 'rating', 'shortFormattedAddress',
            'priceLevel', 'regularOpeningHours', 'photos', 'location'
        ],
        locationRestriction: {
            center: center,
            radius: parseFloat(radius)
        },
        includedPrimaryTypes: ['restaurant'],
        maxResultCount: 20,
        rankPreference: SearchNearbyRankPreference.POPULARITY
    }

    try {
        let places, lastErr
        // ✅ 最多重試 2 次，應對 Google INTERNAL 500 暫時性錯誤
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const result = await Place.searchNearby(request)
                places = result.places
                break
            } catch (e) {
                lastErr = e
                if (attempt < 2) {
                    console.warn(`[Places] 第 ${attempt} 次請求失敗，1.5 秒後重試...`, e.message)
                    await new Promise(r => setTimeout(r, 1500))
                }
            }
        }
        if (!places) throw lastErr

        if (places.length === 0) return []

        return places
            .map(place => {
                let isOpen = true;
                try {
                    if (place.regularOpeningHours) {
                        isOpen = typeof place.regularOpeningHours.openNow === 'function'
                            ? place.regularOpeningHours.openNow()
                            : (place.regularOpeningHours.openNow ?? true);
                    }
                } catch (e) {
                    console.warn(`無法判斷 ${place.id} 的營業狀態，預設為開啟`);
                }

                return {
                    id: place.id,
                    name: place.displayName?.text || place.displayName || '未知餐廳',
                    rating: place.rating || 0,
                    address: place.shortFormattedAddress,
                    price: place.priceLevel ? parseInt(place.priceLevel.replace('PRICE_LEVEL_', '')) : 0,
                    open: isOpen,
                    photo: place.photos && place.photos.length > 0 ? place.photos[0].getURI() : null,
                    location: place.location
                }
            })
            .filter(place => place.rating >= minRating)

    } catch (err) {
        console.error("searchNearby 失敗:", err)
        if (err.status === 'PERMISSION_DENIED' || err.message?.includes('PERMISSION_DENIED')) {
            throw new Error("Google Maps 權限錯誤：請確保您已啟用 'Places API (New)' 並在 Console 設定好金鑰限制。")
        }
        throw err
    }
}

export const fetchPlaceDetails = async (placeId) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) return null

    const { Place } = window.google.maps.places
    const place = new Place({ id: placeId })

    try {
        // 嘗試抓取電話與基礎資訊 (這些是標準欄位)
        await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'nationalPhoneNumber']
        })

        // 嘗試單獨抓取 googleMapsUri，如果失敗就回傳手動生成的連結
        let mapUrl = `https://www.google.com/maps/search/?api=1&query=Restaurant&query_place_id=${placeId}`
        try {
            await place.fetchFields({ fields: ['googleMapsLinks'] })
            if (place.googleMapsLinks && place.googleMapsLinks.length > 0) {
                mapUrl = place.googleMapsLinks[0].uri || mapUrl
            }
        } catch (e) {
            console.warn("無法抓取 googleMapsLinks，使用備案連結")
        }

        return {
            mapUrl: mapUrl,
            phone: place.nationalPhoneNumber || null,
            website: null // 暫時移除以避免 Enterprise 權限錯誤
        }
    } catch (err) {
        console.error("fetchFields 失敗:", err)
        return {
            mapUrl: `https://www.google.com/maps/search/?api=1&query=Restaurant&query_place_id=${placeId}`,
            phone: null,
            website: null
        }
    }
}

export const calculateTravelInfo = (originCoords, destinationCoords) => {
    return new Promise((resolve) => {
        if (!window.google || !window.google.maps) {
            resolve({ distance: '未知', duration: '--' })
            return
        }
        const service = new window.google.maps.DistanceMatrixService()

        service.getDistanceMatrix(
            {
                origins: [originCoords],
                destinations: [destinationCoords],
                travelMode: window.google.maps.TravelMode.WALKING,
            },
            (response, status) => {
                if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
                    resolve({
                        distance: response.rows[0].elements[0].distance.text,
                        duration: response.rows[0].elements[0].duration.text
                    })
                } else {
                    resolve({ distance: '未知', duration: '--' })
                }
            }
        )
    })
}
