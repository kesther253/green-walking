
console.log("그린워킹 경로 추천 페이지 연결 성공!");

let routeMap;
let routeLayer;
let startMarker;
let endMarker;

// HTML에 표시할 문자열 안전 처리
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// 지도 초기화
document.addEventListener("DOMContentLoaded", () => {
    routeMap = L.map("route-map").setView([37.5636, 127.0369], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(routeMap);

    const button = document.getElementById("search-route-btn");
    if (button) button.addEventListener("click", searchRoute);

    ["start-point", "end-point"].forEach(id => {
        const input = document.getElementById(id);

        if (input) {
            input.addEventListener("keydown", event => {
                if (event.key === "Enter") searchRoute();
            });
        }
    });

    console.log("산책 경로 지도 표시 성공!");
});

// 장소 이름을 좌표로 변환
async function getLocation(placeName) {
    const url = new URL("https://nominatim.openstreetmap.org/search");

    url.search = new URLSearchParams({
        q: `${placeName}, 성동구, 서울특별시, 대한민국`,
        format: "jsonv2",
        limit: "1",
        countrycodes: "kr"
    });

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("장소 검색 서버에 연결할 수 없습니다.");
    }

    const data = await response.json();

    if (!data.length) {
        throw new Error(`장소를 찾을 수 없습니다: ${placeName}`);
    }

    return {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
        name: data[0].display_name
    };
}

// 도보 경로 검색
async function getWalkingRoute(start, end) {
    const url =
        `https://routing.openstreetmap.de/routed-foot/route/v1/driving/` +
        `${start.lon},${start.lat};${end.lon},${end.lat}` +
        `?overview=full&geometries=geojson`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("도보 경로 서버에 연결할 수 없습니다.");
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes.length) {
        throw new Error("해당 구간의 도보 경로를 찾을 수 없습니다.");
    }

    return data.routes[0];
}

// 두 좌표 사이의 직선거리 계산
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = value => value * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 경로 주변 공원 분석
async function findParksNearRoute(geometry) {
    const response = await fetch("./data/parks.json");

    if (!response.ok) {
        throw new Error("공원 데이터를 불러올 수 없습니다.");
    }

    const parks = await response.json();
    const coordinates = geometry.coordinates;

    const results = parks.map(park => {
        let minDistance = Infinity;

        for (const [lon, lat] of coordinates) {
            const distance = calculateDistance(
                park.latitude,
                park.longitude,
                lat,
                lon
            );

            minDistance = Math.min(minDistance, distance);
        }

        return { ...park, distance: minDistance };
    });

    return results
        .filter(park => park.distance <= 300)
        .sort((a, b) => a.distance - b.distance);
}

// 거리 표시
function formatDistance(distance) {
    if (distance >= 1000) {
        return (distance / 1000).toFixed(2) + "km";
    }

    return Math.round(distance) + "m";
}

// 소요 시간 표시
function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
        return `${minutes}분`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}시간 ${remainingMinutes}분`;
}

// ----------------------------------------
// 쾌적도 점수 계산
// ----------------------------------------

// 에어코리아 등급을 점수로 변환
// 1: 좋음, 2: 보통, 3: 나쁨, 4: 매우나쁨
function gradeToScore(grade) {
    const scores = {
        "1": 100,
        "2": 75,
        "3": 40,
        "4": 10
    };

    return scores[String(grade)] ?? null;
}

// PM10과 PM2.5 점수의 평균 계산
function calculateAirScore(item) {
    const pm10Score = gradeToScore(item.pm10Grade);
    const pm25Score = gradeToScore(item.pm25Grade);

    const validScores = [pm10Score, pm25Score]
        .filter(score => score !== null);

    if (validScores.length === 0) {
        return null;
    }

    return Math.round(
        validScores.reduce((sum, score) => sum + score, 0) /
        validScores.length
    );
}

// 성동구 대기질 데이터 조회
async function getSeongdongAirScore() {
    if (typeof getAirQuality !== "function") {
        throw new Error(
            "getAirQuality 함수를 찾을 수 없습니다. api.js 로드 순서를 확인해 주세요."
        );
    }

    const items = await getAirQuality();

    if (!Array.isArray(items)) {
        throw new Error("대기질 데이터 형식이 올바르지 않습니다.");
    }

    const station = items.find(item =>
        item.stationName === "성동구"
    );

    if (!station) {
        throw new Error("성동구 측정소 데이터를 찾지 못했습니다.");
    }

    const score = calculateAirScore(station);

    if (score === null) {
        throw new Error("성동구 측정소의 대기질 등급 정보가 없습니다.");
    }

    return {
        score,
        stationName: station.stationName,
        dataTime: station.dataTime || "측정 시각 정보 없음",
        pm10Grade: station.pm10Grade,
        pm25Grade: station.pm25Grade
    };
}

// 녹지 접근성 점수 계산
function calculateGreenScore(nearbyParks) {
    if (nearbyParks.length === 0) {
        return 20;
    }

    const nearestDistance = nearbyParks[0].distance;

    let distanceScore;

    if (nearestDistance <= 100) {
        distanceScore = 100;
    } else if (nearestDistance <= 200) {
        distanceScore = 85;
    } else {
        distanceScore = 70;
    }

    // 공원 수가 많을수록 추가 점수
    const countBonus = Math.min(nearbyParks.length - 1, 3) * 5;

    return Math.min(100, distanceScore + countBonus);
}

// 종합 쾌적도 등급
function getComfortGrade(score) {
    if (score >= 85) {
        return { label: "매우 쾌적", className: "excellent" };
    }

    if (score >= 70) {
        return { label: "쾌적", className: "good" };
    }

    if (score >= 50) {
        return { label: "보통", className: "normal" };
    }

    return { label: "주의", className: "caution" };
}

// 쾌적도 카드 생성
function renderComfortCard(air, greenScore, totalScore, parkCount) {
    const grade = getComfortGrade(totalScore);

    return `
        <section class="comfort-card">
            <div class="comfort-card-header">
                <div>
                    <span class="comfort-eyebrow">GREEN WALKING INDEX</span>
                    <h4>산책 경로 쾌적도</h4>
                </div>

                <span class="comfort-grade ${grade.className}">
                    ${grade.label}
                </span>
            </div>

            <div class="comfort-score-row">
                <strong class="comfort-total-score">${totalScore}</strong>
                <span class="comfort-score-unit">/ 100점</span>
            </div>

            <div class="comfort-score-track">
                <div
                    class="comfort-score-fill"
                    style="width: ${totalScore}%"
                ></div>
            </div>

            <div class="comfort-detail-grid">
                <div class="comfort-detail">
                    <span>
                        대기질 점수
                        <small>60%</small>
                    </span>

                    <strong>${air.score}<small>점</small></strong>

                    <p>
                        ${escapeHTML(air.stationName)} 측정소 기준<br>
                        ${escapeHTML(air.dataTime)}
                    </p>
                </div>

                <div class="comfort-detail">
                    <span>
                        녹지 접근성
                        <small>40%</small>
                    </span>

                    <strong>${greenScore}<small>점</small></strong>

                    <p>
                        경로 300m 이내 공원 ${parkCount}곳
                    </p>
                </div>
            </div>

            <p class="comfort-method-note">
                종합 점수 = 대기질 점수 × 0.6 + 녹지 접근성 점수 × 0.4.
                대기질은 성동구 측정소 관측값이며 경로 전체의 실측값이 아닙니다.
                녹지 접근성은 공원 위치와 경로 좌표를 이용한 추정값입니다.
            </p>
        </section>
    `;
}

// ----------------------------------------
// 분석 결과 화면
// ----------------------------------------

function renderRouteResult(
    startName,
    endName,
    route,
    nearbyParks,
    air,
    greenScore,
    totalScore
) {
    const resultElement = document.getElementById("route-result");

    const parkMarkup = nearbyParks.length
        ? `<div class="route-park-list">
            ${nearbyParks.slice(0, 5).map(park => `
                <article class="route-park-card">
                    <div>
                        <strong>${escapeHTML(park.name)}</strong>
                        <p>${escapeHTML(park.type || "도시공원")}</p>
                    </div>

                    <span class="route-park-distance">
                        ${Math.round(park.distance)}m
                    </span>
                </article>
            `).join("")}
          </div>`
        : `<div class="route-no-parks">
            이 경로에서 300m 이내에 확인된 공원이 없습니다.
          </div>`;

    resultElement.innerHTML = `
        <div class="route-success-head">
            <h3>산책 경로 분석이 완료됐어요.</h3>
            <span>ANALYSIS COMPLETE</span>
        </div>

        ${renderComfortCard(
            air,
            greenScore,
            totalScore,
            nearbyParks.length
        )}

        <div class="route-metrics">
            <div class="route-metric">
                <span class="route-metric-label">총 이동 거리</span>
                <strong class="route-metric-value">
                    ${formatDistance(route.distance)}
                </strong>
            </div>

            <div class="route-metric">
                <span class="route-metric-label">예상 소요 시간</span>
                <strong class="route-metric-value">
                    ${formatDuration(route.duration)}
                </strong>
            </div>

            <div class="route-metric">
                <span class="route-metric-label">경로 주변 공원</span>
                <strong class="route-metric-value">
                    ${nearbyParks.length}<small>곳</small>
                </strong>
            </div>
        </div>

        <div class="route-places">
            <strong>${escapeHTML(startName)}</strong>
            <span class="place-arrow" aria-hidden="true">→</span>
            <strong>${escapeHTML(endName)}</strong>
        </div>

        <div class="route-parks-heading">
            <h4>경로 주변의 초록 쉼터</h4>
            <span>경로에서 300m 이내 · 가까운 순</span>
        </div>

        ${parkMarkup}

        <p class="route-analysis-note">
            공원까지의 거리는 경로 좌표점을 기준으로 계산한 직선거리 근사값입니다.
            실제 보행 접근 거리와 다를 수 있습니다.
        </p>
    `;
}

// 대기질 조회 실패 시 경로 분석은 유지하고 점수만 안내
function renderRouteResultWithoutScore(
    startName,
    endName,
    route,
    nearbyParks,
    message
) {
    const resultElement = document.getElementById("route-result");

    const parkMarkup = nearbyParks.length
        ? `<div class="route-park-list">
            ${nearbyParks.slice(0, 5).map(park => `
                <article class="route-park-card">
                    <div>
                        <strong>${escapeHTML(park.name)}</strong>
                        <p>${escapeHTML(park.type || "도시공원")}</p>
                    </div>
                    <span class="route-park-distance">
                        ${Math.round(park.distance)}m
                    </span>
                </article>
            `).join("")}
          </div>`
        : `<div class="route-no-parks">
            이 경로에서 300m 이내에 확인된 공원이 없습니다.
          </div>`;

    resultElement.innerHTML = `
        <div class="route-success-head">
            <h3>산책 경로 분석이 완료됐어요.</h3>
            <span>ANALYSIS COMPLETE</span>
        </div>

        <section class="comfort-card">
            <h4>산책 경로 쾌적도</h4>
            <p class="comfort-method-note">${escapeHTML(message)}</p>
        </section>

        <div class="route-metrics">
            <div class="route-metric">
                <span class="route-metric-label">총 이동 거리</span>
                <strong class="route-metric-value">
                    ${formatDistance(route.distance)}
                </strong>
            </div>

            <div class="route-metric">
                <span class="route-metric-label">예상 소요 시간</span>
                <strong class="route-metric-value">
                    ${formatDuration(route.duration)}
                </strong>
            </div>

            <div class="route-metric">
                <span class="route-metric-label">경로 주변 공원</span>
                <strong class="route-metric-value">
                    ${nearbyParks.length}<small>곳</small>
                </strong>
            </div>
        </div>

        <div class="route-places">
            <strong>${escapeHTML(startName)}</strong>
            <span class="place-arrow" aria-hidden="true">→</span>
            <strong>${escapeHTML(endName)}</strong>
        </div>

        <div class="route-parks-heading">
            <h4>경로 주변의 초록 쉼터</h4>
            <span>경로에서 300m 이내 · 가까운 순</span>
        </div>

        ${parkMarkup}
    `;
}

// ----------------------------------------
// 경로 검색 실행
// ----------------------------------------

async function searchRoute() {
    const startInput = document.getElementById("start-point");
    const endInput = document.getElementById("end-point");
    const resultElement = document.getElementById("route-result");
    const button = document.getElementById("search-route-btn");

    const startName = startInput.value.trim();
    const endName = endInput.value.trim();

    if (!startName || !endName) {
        resultElement.innerHTML = `
            <div class="route-error">
                출발지와 도착지를 모두 입력해 주세요.
            </div>
        `;
        return;
    }

    button.disabled = true;
    button.innerHTML = "경로를 찾고 있어요...";

    resultElement.innerHTML = `
        <div class="route-loading">
            장소와 도보 경로, 대기질 및 주변 공원 정보를 분석하고 있습니다.
            잠시만 기다려 주세요.
        </div>
    `;

    try {
        const start = await getLocation(startName);

        // Nominatim 요청 간격 유지
        await new Promise(resolve => setTimeout(resolve, 1100));

        const end = await getLocation(endName);

        const route = await getWalkingRoute(start, end);
        const nearbyParks = await findParksNearRoute(route.geometry);

        // 녹지 접근성 점수 계산
        const greenScore = calculateGreenScore(nearbyParks);

        // 대기질 조회
        let air;

        try {
            air = await getSeongdongAirScore();
        } catch (airError) {
            console.warn("대기질 점수 계산 실패:", airError);

            renderRouteResultWithoutScore(
                startName,
                endName,
                route,
                nearbyParks,
                "대기질 데이터를 불러오지 못해 종합 쾌적도 점수는 표시하지 않았습니다. 잠시 후 다시 검색해 주세요."
            );
        }

        // 대기질 데이터가 정상적으로 조회된 경우에만 종합 점수 계산
        if (air) {
            const totalScore = Math.round(
                air.score * 0.6 + greenScore * 0.4
            );

            renderRouteResult(
                startName,
                endName,
                route,
                nearbyParks,
                air,
                greenScore,
                totalScore
            );
        }

        // 이전 경로 및 마커 제거
        if (routeLayer) routeMap.removeLayer(routeLayer);
        if (startMarker) routeMap.removeLayer(startMarker);
        if (endMarker) routeMap.removeLayer(endMarker);

        // 새 경로 지도에 표시
        routeLayer = L.geoJSON(route.geometry, {
            style: {
                color: "#39865a",
                weight: 6,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round"
            }
        }).addTo(routeMap);

        startMarker = L.marker([start.lat, start.lon])
            .addTo(routeMap)
            .bindPopup("출발지: " + escapeHTML(startName));

        endMarker = L.marker([end.lat, end.lon])
            .addTo(routeMap)
            .bindPopup("도착지: " + escapeHTML(endName));

        routeMap.fitBounds(routeLayer.getBounds(), {
            padding: [40, 40]
        });

        setTimeout(() => routeMap.invalidateSize(), 100);

    } catch (error) {
        console.error("경로 검색 오류:", error);

        resultElement.innerHTML = `
            <div class="route-error">
                <strong>경로 검색에 실패했습니다.</strong><br>
                ${escapeHTML(error.message)}<br>
                장소 이름을 다시 확인하거나 잠시 후 시도해 주세요.
            </div>
        `;
    } finally {
        button.disabled = false;
        button.innerHTML = '산책 경로 찾기 <span aria-hidden="true">→</span>';
    }
}
