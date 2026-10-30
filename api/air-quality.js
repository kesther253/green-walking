
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "허용되지 않은 요청입니다."
    });
  }

  const API_KEY = process.env.AIRKOREA_SERVICE_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      error: "API 키가 설정되지 않았습니다."
    });
  }

  const API_URL =
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesure";

  const params = new URLSearchParams({
    serviceKey: API_KEY,
    returnType: "json",
    numOfRows: "100",
    pageNo: "1",
    sidoName: "서울",
    ver: "1.0"
  });

  try {
    const response = await fetch(
      `${API_URL}?${params.toString()}`
    );

    if (!response.ok) {
      return res.status(502).json({
        error: "에어코리아 API 요청에 실패했습니다."
      });
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error) {
    console.error("대기질 API 오류:", error);

    return res.status(500).json({
      error: "대기질 정보를 가져오지 못했습니다."
    });
  }
}
