---
title: "Xóa nhiều repository GitHub bằng một lệnh: nhanh nhưng phải có chốt an toàn"
description: "Hướng dẫn dọn nhiều repository GitHub bằng GitHub CLI trên Mac: xem trước danh sách, bảo vệ repo quan trọng, xác nhận trước khi xóa và thu hồi quyền delete_repo."
published: 2026-11-22
category: "GitHub"
tags: ["GitHub", "GitHub CLI", "DevOps", "Bash", "Bảo mật", "Repository"]
author: "TechBlogTip"
draft: false
---

Bạn từng tạo hàng chục repository để thử giao diện, nghiên cứu tính năng hoặc dựng bản demo. Đến lúc dọn dẹp, việc mở từng repository → Settings → Danger Zone → xác nhận xóa nhiều lần trở thành thao tác lặp đi lặp lại. GitHub CLI cho phép gom các thao tác ấy thành một quy trình có thể kiểm tra trước, nhưng **tiết kiệm cú nhấp chuột không được đánh đổi bằng nguy cơ xóa nhầm mã nguồn**.

Tình huống trong bài: có **6 repository muốn xóa** và **2 repository tuyệt đối phải giữ**. Thay vì cấp một token rồi dán vào cuộc trò chuyện, ta đăng nhập GitHub bằng trình duyệt, kiểm tra đúng tài khoản, cố định danh sách được phép xóa, yêu cầu xác nhận thủ công, cuối cùng thu hồi quyền đặc biệt. Các tên trong ví dụ bên dưới là tên giả định — bạn cần thay bằng repository của mình.

## GitHub CLI khác gì thao tác xóa bằng giao diện?

| Tiêu chí | Xóa trong GitHub web | Dùng GitHub CLI |
| :-- | :-- | :-- |
| Với một repository | Trực quan, phù hợp | Một lệnh |
| Với nhiều repository | Lặp lại từng trang Settings | Vòng lặp trên danh sách xác định |
| Kiểm tra trước khi xóa | Đọc từng màn hình xác nhận | Xem trước toàn bộ danh sách (dry-run) |
| Nguy cơ thao tác nhầm | Chọn nhầm trên web | Viết sai tên hoặc danh sách trong script |
| Cơ chế an toàn nên dùng | Đọc cảnh báo và xác nhận tên | Tài khoản đúng + allowlist + danh sách bảo vệ + xác nhận thủ công |

Điểm đáng giá nhất của CLI không chỉ là tốc độ, mà là khả năng **viết ra một quy trình có thể xem lại trước khi thực thi**. Tuy nhiên, lệnh xóa là lệnh nguy hiểm: một script sai có thể gây thiệt hại nhanh hơn nhiều thao tác thủ công.

## Mô hình 5 bước trước khi bấm xóa

Một quy trình hợp lý có 5 chốt: **đúng tài khoản → đúng danh sách → kiểm tra repo bảo vệ → người dùng xác nhận → thu hồi quyền sau thao tác**.

Chẳng hạn, nếu hai repository quan trọng nằm trong danh sách bảo vệ, script phải dừng ngay nếu vô tình gặp một trong hai tên ấy ở danh sách xóa. Danh sách này cần được **khai báo tường minh**, không dùng lệnh xóa tất cả repo rồi lọc trừ một vài tên theo mẫu ký tự mơ hồ.

Trước bước xóa thật, hãy xem từng repository có còn là nguồn chạy production, GitHub Pages, GitHub Actions, submodule hay tích hợp với Cloudflare không. **Xóa repository GitHub không đồng nghĩa tự động dọn sạch Worker, domain hoặc dữ liệu Google Drive bên ngoài**. Nếu còn phụ thuộc, xử lý chúng theo một kế hoạch riêng.

## Chuẩn bị GitHub CLI và đăng nhập không chia sẻ token

Trên macOS có Homebrew:

~~~bash
brew install gh
gh auth login --web
gh auth status
gh api user --jq '.login'
~~~

Dòng cuối cho biết tài khoản đang được GitHub CLI sử dụng. Nếu bạn có nhiều tài khoản, **đừng bỏ qua bước này**. Cơ chế đăng nhập bằng trình duyệt giúp bạn không phải dán personal access token vào chat, tài liệu công khai hay tập lệnh.

Chưa cần quyền xóa repository ở giai đoạn này. Chỉ yêu cầu scope đặc biệt **delete_repo** sau khi đã xem danh sách và đồng ý thực hiện.

## Script xóa nhiều repo, có dry-run và danh sách bảo vệ

Đây là ví dụ Bash có thể chạy trên macOS. Hãy thay **YOUR_GITHUB_USERNAME** và các tên repository giả định. Script **không tự quét toàn bộ tài khoản để tìm repo rồi xóa**; chỉ xử lý các tên do bạn nhập chính xác.

~~~bash
#!/usr/bin/env bash
set -euo pipefail

OWNER="YOUR_GITHUB_USERNAME"
TO_DELETE=(legacy-blog demo-site old-tool)
PROTECTED=(important-blog editor-core)

command -v gh >/dev/null || {
  echo "Chưa cài GitHub CLI (gh)."
  exit 1
}

gh auth status >/dev/null

ACTIVE_USER="$(gh api user --jq '.login')"
if [[ "$ACTIVE_USER" != "$OWNER" ]]; then
  echo "Sai tài khoản: $ACTIVE_USER (cần $OWNER)"
  exit 1
fi

echo "=== DRY-RUN: kiểm tra các repository ==="
for repo in "${TO_DELETE[@]}"; do
  for keep in "${PROTECTED[@]}"; do
    if [[ "$repo" == "$keep" ]]; then
      echo "DỪNG: $repo thuộc danh sách được bảo vệ."
      exit 1
    fi
  done
  gh repo view "$OWNER/$repo" >/dev/null
  echo "SẼ XÓA: $OWNER/$repo"
done

echo "SẼ GIỮ NGUYÊN:"
for repo in "${PROTECTED[@]}"; do
  gh repo view "$OWNER/$repo" >/dev/null
  echo "GIỮ: $OWNER/$repo"
done

echo "Đã kiểm tra ${#TO_DELETE[@]} repository cần xóa."
read -r -p "Gõ DELETE để thực sự xóa: " CONFIRM
if [[ "$CONFIRM" != "DELETE" ]]; then
  echo "Đã hủy, không xóa repository nào."
  exit 0
fi

# Chỉ yêu cầu quyền nhạy cảm sau khi đã xác nhận.
gh auth refresh -s delete_repo

for repo in "${TO_DELETE[@]}"; do
  echo "Đang xóa $OWNER/$repo"
  gh repo delete "$OWNER/$repo" --yes
done

gh auth refresh --remove-scopes delete_repo
echo "Đã chạy xong danh sách xóa."
~~~

**Quan trọng:** đoạn script chỉ là ví dụ, **không xóa gì nếu bạn chưa chạy và xác nhận**. Một khi người dùng gõ *DELETE*, các repository trong danh sách sẽ thực sự bị xóa. Nếu một lệnh lỗi giữa chừng, Bash dừng lại và những repository đã xóa trước đó **không được khôi phục tự động**. Trong tình huống lỗi, hãy kiểm tra trạng thái từng repository và tự chạy lệnh thu hồi quyền ở phần dưới.

Với repository **private có fork**, GitHub CLI có thể yêu cầu xác nhận bổ sung ngay cả khi dùng `--yes`; đây là hành vi bảo vệ khỏi việc kéo theo xóa các private fork. **Không tùy tiện thêm** `--accept-cascading-deletion-of-private-forks` nếu chưa hiểu hậu quả.

## Ba câu lệnh quan trọng cần hiểu

| Lệnh | Tác dụng |
| :-- | :-- |
| `gh auth refresh -s delete_repo` | Xin scope cho phép xóa repository |
| `gh repo delete OWNER/REPO --yes` | Xóa chính xác repository đã chỉ định, không phải toàn bộ tài khoản |
| `gh auth refresh --remove-scopes delete_repo` | Gỡ scope xóa khỏi thông tin xác thực đang dùng |

`--yes` chỉ bỏ qua xác nhận thông thường của lệnh xóa khi đã chỉ rõ OWNER/REPO; **nó không làm thao tác trở nên an toàn**. Các chốt kiểm tra trước đó mới là phần giảm thiểu sai sót.

Nếu quy trình bị ngắt trước bước thu hồi quyền, hãy thực hiện lại:

~~~bash
gh auth refresh --remove-scopes delete_repo
gh auth status
~~~

## Nên sao lưu thế nào và xóa rồi có khôi phục được không?

Với mã nguồn còn giá trị, hãy lưu bản sao có kiểm soát trước khi xóa. Một repository có thể chứa **branches, tags, Git history, issues, PR, release assets, Pages configuration và secrets**; chỉ sao lưu bằng cách tải ZIP nhánh chính không đồng nghĩa giữ đầy đủ mọi tài nguyên ấy. Bản sao cũng phải được bảo vệ đúng mức, đặc biệt với repo private.

Theo GitHub Docs, **một số repository bị xóa có thể khôi phục trong vòng 90 ngày**, nhưng có điều kiện ngoại lệ (đặc biệt liên quan đến mạng fork), và không nên xem thời hạn đó như một phương án backup đáng tin cậy. Xóa repository public không tự xóa public fork; với private repository, các private fork có thể bị xóa theo. Quyền của nhóm cộng tác cũng có thể bị mất vĩnh viễn.

## Khi nào không nên dùng script xóa hàng loạt?

Nếu repository vẫn là nguồn deploy, chứa tài sản chưa sao lưu, có nhiều người cộng tác, hoặc bạn chưa rõ vai trò của nó trong hệ thống, hãy **archive trước hoặc kiểm toán phụ thuộc rồi mới quyết định**. Nếu chỉ cần xóa một repository, giao diện GitHub với nhiều bước xác nhận đôi khi dễ kiểm soát hơn.

**Kết luận:** CLI giúp tiết kiệm thời gian, còn kỹ thuật vận hành tốt là **chỉ xóa những gì được chỉ định rõ, luôn cho xem trước, bảo vệ tài sản quan trọng và cấp quyền nhạy cảm trong thời gian ngắn nhất cần thiết**. Đó mới là cách dọn GitHub nhanh mà không biến vài giây tiện lợi thành hàng ngày khôi phục dữ liệu.

---

**Tài liệu chính thức:** [GitHub CLI — gh repo delete](https://cli.github.com/manual/gh_repo_delete) · [GitHub CLI — gh auth refresh](https://cli.github.com/manual/gh_auth_refresh) · [GitHub Docs — Deleting a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository) · [GitHub Docs — Restoring a deleted repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/restoring-a-deleted-repository).

*Bài viết dùng tên repository giả định và không chứng nhận bất kỳ repository thực tế nào đã được xóa.*