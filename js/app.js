async function initApp() {
    const container = document.getElementById("air-container");

    try {
        const airData = await getAirQuality();

        const seongdong = airData.find(
            item => item.stationName === "성동구"
        );

        if (!seongdong) {
            container.textContent = "성동구 측정소 데이터를 찾을 수 없습니다.";
            return;
        }

        function getGrade(grade) {
            const grades = {
                "1": "좋음",
                "2": "보통",
                "3": "나쁨",
                "4": "매우 나쁨"
            };

            return grades[grade] || "정보 없음";
        }

        container.innerHTML = `
            <div class="air-grid">
                <div class="air-card">
                    <h3>미세먼지 PM10</h3>
                    <p class="air-value">
                        ${seongdong.pm10Value ?? "-"}
                        <span>㎍/㎥</span>
                    </p>
                    <span class="grade">
                        ${getGrade(seongdong.pm10Grade)}
                    </span>
                </div>

                <div class="air-card">
                    <h3>초미세먼지 PM2.5</h3>
                    <p class="air-value">
                        ${seongdong.pm25Value ?? "-"}
                        <span>㎍/㎥</span>
                    </p>
                    <span class="grade">
                        ${getGrade(seongdong.pm25Grade)}
                    </span>
                </div>
            </div>

            <p class="air-time">
                측정소: ${seongdong.stationName}
                | 측정 시각: ${seongdong.dataTime || "정보 없음"}
            </p>
        `;

        console.log("성동구 대기질 화면 표시 성공!");

    } catch (error) {
        console.error("대기질 화면 표시 실패:", error);
        container.textContent = "대기질 정보를 불러오지 못했습니다.";
    }
}
// 성동구 공원 지도 생성
async function initParkMap() {
    const mapElement = document.getElementById("park-map");

    if (!mapElement) return;

    // 성동구 중심 좌표
    const map = L.map("park-map").setView(
        [37.5636, 127.0369],
        13
    );

    // 타일 연결
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    try {
        // JSON 공원 데이터 가져오기
        const response = await fetch("./data/parks.json");

        if (!response.ok) {
            throw new Error("공원 데이터를 불러오지 못했습니다.");
        }

        const parks = await response.json();

        // 공원별 마커 생성
        parks.forEach(park => {
            const marker = L.marker([
                park.latitude,
                park.longitude
            ]).addTo(map);

            marker.bindPopup(`
                <strong>${park.name}</strong>
                <br>
                주소: ${park.address || "주소 정보 없음"}
                <br>
                공원구분: ${park.type || "정보 없음"}
                <br>
                면적: ${park.area ?? "정보 없음"}㎡
            `);
        });

        document.getElementById("park-count").textContent =
            `성동구 공원 ${parks.length}곳을 지도에 표시했습니다.`;

        console.log("공원 지도 표시 성공:", parks.length);

    } catch (error) {
        console.error("공원 지도 오류:", error);

        document.getElementById("park-count").textContent =
            "공원 데이터를 불러오지 못했습니다.";
    }
}
// 내 주변 공원 추천 기능
async function findNearbyParks() {
    const button = document.getElementById("find-nearby-btn");
    const result = document.getElementById("nearby-results");

    button.disabled = true;
    button.textContent = "공원 검색 중...";

    try {
        // 현재 위치 가져오기
        if (!navigator.geolocation) {
            throw new Error("현재 브라우저에서 위치 정보를 지원하지 않습니다.");
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000
                }
            );
        });

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // 공원 데이터 가져오기
        const response = await fetch("./data/parks.json");

        if (!response.ok) {
            throw new Error("공원 데이터를 불러오지 못했습니다.");
        }

        const parks = await response.json();

        // 두 좌표 사이의 거리 계산 (Haversine 공식)
        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const toRad = value => value * Math.PI / 180;

            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);

            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;

            return 2 * R * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );
        }

        // 거리 계산 및 가까운 순서로 정렬
        const nearbyParks = parks
            .filter(park =>
                Number.isFinite(Number(park.latitude)) &&
                Number.isFinite(Number(park.longitude)) &&
                park.latitude !== null &&
                park.longitude !== null
            )
            .map(park => ({
                ...park,
                distance: calculateDistance(
                    userLat,
                    userLng,
                    Number(park.latitude),
                    Number(park.longitude)
                )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3);

        // 결과 출력
        if (nearbyParks.length === 0) {
            result.textContent = "주변 공원을 찾을 수 없습니다.";
            return;
        }

        result.innerHTML = `
            <h3>가까운 공원 TOP 3</h3>

            ${nearbyParks.map((park, index) => `
                <div class="recommend-card">
                    <h4>${index + 1}. ${park.name}</h4>
                    <p>
                        현재 위치에서
                        <strong>
                            ${park.distance < 1
                                ? Math.round(park.distance * 1000) + "m"
                                : park.distance.toFixed(2) + "km"}
                        </strong>
                    </p>
                    <p>${park.address || "주소 정보 없음"}</p>
                </div>
            `).join("")}
            <p class="distance-notice">
                ※ 거리는 직선거리 기준이며 실제 도보 거리는 다를 수 있습니다.
            </p>
        `;

        console.log("주변 공원 추천 결과:", nearbyParks);

    } catch (error) {
        console.error("주변 공원 검색 실패:", error);

        if (error.code === 1) {
            result.textContent =
                "위치 권한이 거부되었습니다. 브라우저에서 위치 권한을 허용해 주세요.";
        } else {
            result.textContent =
                error.message || "위치를 확인하지 못했습니다.";
        }

    } finally {
        button.disabled = false;
        button.textContent = "내 주변 공원 찾기";
    }
}

// 버튼 이벤트 연결
document
    .getElementById("find-nearby-btn")
    .addEventListener("click", findNearbyParks);

initParkMap();
initApp();